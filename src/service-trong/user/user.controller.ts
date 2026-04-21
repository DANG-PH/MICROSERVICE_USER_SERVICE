import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { UserService } from './user.service';
import { UserWebItemService } from 'src/service-trong/user-web-item/user-web-item.service';
import { User_Entity } from './user.entity';
import { User_Game_Stats } from 'src/service-trong/user-game-stats/user-game-stats.entity';
import { User_Position } from 'src/service-trong/user-position/user-positon.entity';
import type {User,GetUserRequest, UserResponse, AddBalanceRequest, BalanceResponse, AddItemRequest, MessageResponse, UsernameRequest, ItemListResponse, UseItemRequest, UserListResponse, RegisterResponse, RegisterRequest, UseBalanceRequest, UpdateBalanceRequest, GetPositionRequest, GetPositionResponse, SavePositionRequest, SavePositionResponse, UseItemResponse } from 'proto/user.pb';
import { USER_SERVICE_NAME } from 'proto/user.pb';
import { User_Web_Item } from 'src/service-trong/user-web-item/user-web-item.entity';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { DeTuService } from 'src/service-ngoai/detu/detu.service';
import { PayService } from 'src/service-ngoai/pay/pay.service';
import { Pay } from 'proto/pay.pb';
import { UserPositionService } from '../user-position/user-position.service';
import Redis from 'ioredis'
import { LessThanOrEqual, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreatePayOutbox } from './register-outbox.entity';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BuyItemOutbox } from './buy-item-outbox.entity';

@Controller()
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly userWebItemService: UserWebItemService,
    private readonly deTuService: DeTuService,
    private readonly payService: PayService,
    private readonly userPosition: UserPositionService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    @InjectRepository(User_Entity)
    private readonly userRepository: Repository<User_Entity>,
    @InjectRepository(CreatePayOutbox)
    private readonly createPayOutboxRepo: Repository<CreatePayOutbox>,
    @InjectRepository(BuyItemOutbox)
    private readonly buyItemOutboxRepo: Repository<BuyItemOutbox>,
    private eventEmitter: EventEmitter2,
  ) {}

  // ========== REGISTER ==========
  @GrpcMethod(USER_SERVICE_NAME, 'Register')
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    const exists = await this.userService.existsByAuthId(data.id);
    // Đã tồn tại → coi như thành công, idempotent
    // Cron retry an toàn mà không bị loop
    if (exists) return { success: true };
    const userMoi = new User_Entity();
    const userMoiGameStats = new User_Game_Stats();
    const userMoiPosition = new User_Position();
    userMoiGameStats.vang = 1000;
    userMoiGameStats.ngoc = 20;
    userMoiGameStats.sucManh = 2000;
    userMoiGameStats.vangNapTuWeb = 0;
    userMoiGameStats.ngocNapTuWeb = 0;
    userMoiGameStats.daVaoTaiKhoanLanDau = false;
    userMoiGameStats.coDeTu = false;
    userMoi.danhSachVatPhamWeb = [];
    userMoi.auth_id = data.id;
    userMoiPosition.x = 100; 
    userMoiPosition.y = 175;
    userMoiPosition.mapHienTai = 'Nhà Gôhan';
    userMoi.userGameStats = userMoiGameStats;
    userMoi.userPosition = userMoiPosition;

    // tạm thời cho trùng gameName, sau này dùng saga pattern để roll back xóa record bên auth khi bên user trả lỗi
    userMoi.gameName = data.gameName ?? "user";
    await this.userRepository.manager.transaction(async (manager) => {
      const user = await manager.save(User_Entity, userMoi);

      const outbox = manager.create(CreatePayOutbox, {
        payload: { userId: user.auth_id },
        status: 'PENDING',
        nextRetryAt: new Date(),
      });
      await manager.save(outbox);
    });

    // Fast path: gọi pay service ngay, không chờ cron
    // Cron chỉ là fallback khi server crash sau transaction commit
    // Không await — pay không cần có ngay, không block response về auth service
    this.eventEmitter.emit('pay.create', { userId: data.id });

    return { success: true };
  }

  parseGrpcError(err: any) {
    if (err?.code !== undefined && err?.details) {
      return { code: err.code, message: err.details };
    }
  }

  @OnEvent('pay.create')
  async handlePayCreate(event: { userId: number }): Promise<void> {
    try {
      await this.payService.createPay({ userId: event.userId });
      await this.createPayOutboxRepo.update(
        { payload: { userId: event.userId } as any, status: 'PENDING' },
        { status: 'DONE' },
      );
    } catch (error) {
      const rpcError = this.parseGrpcError(error);

      // Pay Service throw ALREADY_EXISTS thay vì trả success: true khi ví đã tồn tại
      // → Buộc caller (User Service) phải tự bắt lỗi và xử lý
      // → Nếu có nhiều caller khác gọi createPay, mỗi nơi đều phải tự parseGrpcError
      // → Dễ bỏ sót, không nhất quán
      //
      // Khác với User Service register: trả { success: true } khi auth_id đã tồn tại
      // → Idempotency được xử lý ngay tại downstream (User Service)
      // → Caller (Auth Service) không cần biết gì thêm, không cần catch case đặc biệt
      // → Chuẩn hơn vì outbox/cron retry nhiều lần vẫn an toàn mà không cần logic thêm ở caller
      if (rpcError?.code === status.ALREADY_EXISTS) {
        await this.createPayOutboxRepo.update(
          { payload: { userId: event.userId } as any, status: 'PENDING' },
          { status: 'DONE' },
        );
        return;
      }
      console.warn(`[pay] fast path fail userId: ${event.userId} — cron sẽ retry`, error);
    }
  }

  // ─── CRON: Retry đến khi Pay tạo được ────────────────────────────────────────
  // Không có maxRetries — bắt buộc phải tạo được vì auth + user đã tồn tại
  // Chỉ dừng khi DONE, không bao giờ đánh FAILED

  @Cron(CronExpression.EVERY_5_SECONDS)
  async pollCreatePayOutbox(): Promise<void> {
    const events = await this.createPayOutboxRepo.find({
      where: { status: 'PENDING', nextRetryAt: LessThanOrEqual(new Date()) },
      order: { createdAt: 'ASC' },
      take: 20,
    });

    for (const event of events) {
      const result = await this.createPayOutboxRepo.update(
        { id: event.id, status: 'PENDING' },
        { status: 'PROCESSING' },
      );
      if (result.affected === 0) continue;

      try {
        const payload = event.payload as { userId: number };
        await this.payService.createPay({ userId: payload.userId });
        await this.createPayOutboxRepo.update(event.id, { status: 'DONE' });
      } catch (error) {
        const rpcError = this.parseGrpcError(error);

        // Pay Service throw ALREADY_EXISTS → ví đã tạo rồi (fast path chạy xong trước cron)
        // → đánh DONE luôn, không retry
        if (rpcError?.code === status.ALREADY_EXISTS) {
          await this.createPayOutboxRepo.update(event.id, { status: 'DONE' });
          continue;
        }

        // Retry mãi với exponential backoff — không đánh FAILED
        // Vì auth + user đã tạo rồi, pay bắt buộc phải tạo được
        const errorMessage = error instanceof Error ? error.message : String(error);
        const delayMs = Math.pow(2, Math.min(event.retries, 10)) * 5_000;
        await this.createPayOutboxRepo.update(event.id, {
          status: 'PENDING',
          retries: event.retries + 1,
          nextRetryAt: new Date(Date.now() + delayMs),
          lastError: errorMessage,
        });
        console.warn(`[pay] retry ${event.retries + 1} userId: ${(event.payload as any).userId}`);

        if (event.retries >= 10) {
          console.error(`[pay] CRITICAL retry ${event.retries} — Pay Service có vấn đề?`, {
            userId: (event.payload as any).userId,
            errorMessage,
          });
          // TODO: alert Discord/Slack
        }
      }
    }
  }

  // ─── CRON: Recover stuck PROCESSING ──────────────────────────────────────────

  @Cron('*/30 * * * * *')
  async recoverStuckProcessing(): Promise<void> {
    const stuckThreshold = new Date(Date.now() - 5 * 60_000);
    await this.createPayOutboxRepo.update(
      { status: 'PROCESSING', updatedAt: LessThanOrEqual(stuckThreshold) },
      { status: 'PENDING' },
    );
  }

  // ========== PROFILE ==========
  @GrpcMethod(USER_SERVICE_NAME, 'GetProfile')
  async getProfile(data: GetUserRequest) : Promise<UserResponse> {
    const user = await this.userService.findByAuthIdFull(data.id);
    if (!user) throw new RpcException({code: status.UNAUTHENTICATED ,message: 'User không tồn tại'});
    const userTraVe = {
      ...user.userPosition,
      ...user.userGameStats,
      ...user,
      danhSachVatPhamWeb: user.danhSachVatPhamWeb.map(i => i.item_id)
    };
    return  { user: userTraVe };
  }

  // ========== SAVE GAME ==========
  @GrpcMethod(USER_SERVICE_NAME, 'SaveGame')
  async saveGame(data: { user: User }) {
    const { user } = data;
    const found = await this.userService.findByAuthIdWithStatsAndPosition(user.auth_id);
    if (!found) throw new RpcException({code: status.UNAUTHENTICATED ,message: 'User không tồn tại'});

    found.userGameStats.vang = user.vang;
    found.userGameStats.ngoc = user.ngoc;
    found.userGameStats.sucManh = user.sucManh;
    found.userPosition.x = user.x;
    found.userPosition.y = user.y;
    found.userPosition.mapHienTai = user.mapHienTai;
    if (found.userGameStats.daVaoTaiKhoanLanDau == false) {
      found.userGameStats.daVaoTaiKhoanLanDau = true;
    }
    found.userGameStats.coDeTu = user.coDeTu;

    await this.userService.saveUser(found);

  // DEL dirty flag sau khi write DB thành công
  // -> đặt ở đây vì đây là điểm cuối, chắc chắn data đã được persist
  // -> nếu đặt ở gateway (trước gRPC call) mà gRPC fail thì flag bị xóa nhưng data chưa save
  await this.redis.del(`dirty:${user.auth_id}`)
    return { message: 'Lưu dữ liệu game thành công!' };
  }

  // ========== BALANCE ==========
  @GrpcMethod('UserService', 'GetBalance')
  async getBalance(data: UsernameRequest) {
    const found = await this.userService.findByAuthIdWithStats(data.id);
    if (!found) throw new RpcException({code: status.UNAUTHENTICATED ,message: 'User không tồn tại'});
    return {
      vangNapTuWeb: found.userGameStats.vangNapTuWeb,
      ngocNapTuWeb: found.userGameStats.ngocNapTuWeb,
    };
  }

  @GrpcMethod('UserService', 'UseVangNapTuWeb')
  async useVangNapTuWeb(data: UseBalanceRequest): Promise<BalanceResponse> {
    const found = await this.userService.findByAuthIdWithStats(data.id);
    if (!found) throw new RpcException({code: status.UNAUTHENTICATED ,message: 'User không tồn tại'});
    if (Number(data.amount) === 0) throw new RpcException({code: status.UNAUTHENTICATED ,message: 'vàng bị trừ phải > 0'});
    if (found.userGameStats.vangNapTuWeb < Number(data.amount)) throw new RpcException({code: status.UNAUTHENTICATED ,message: `Không đủ vàng nạp, vàng nạp hiện có: ${found.userGameStats.vangNapTuWeb}`});
    found.userGameStats.vangNapTuWeb -= Number(data.amount);
    await this.userService.saveUser(found);
    return {
      vangNapTuWeb: found.userGameStats.vangNapTuWeb,
      ngocNapTuWeb: found.userGameStats.ngocNapTuWeb
    };
  }

  @GrpcMethod('UserService', 'UseNgocNapTuWeb')
  async useNgocNapTuWeb(data: UseBalanceRequest): Promise<BalanceResponse> {
    const found = await this.userService.findByAuthIdWithStats(data.id);
    if (!found) throw new RpcException({code: status.UNAUTHENTICATED ,message: 'User không tồn tại'});
    if (Number(data.amount) === 0) throw new RpcException({code: status.UNAUTHENTICATED ,message: 'ngọc bị trừ phải > 0'});
    if (found.userGameStats.ngocNapTuWeb < Number(data.amount)) throw new RpcException({code: status.UNAUTHENTICATED ,message: `Không đủ ngọc nạp, ngọc nạp hiện có: ${found.userGameStats.ngocNapTuWeb}`});
    found.userGameStats.ngocNapTuWeb -= Number(data.amount);
    await this.userService.saveUser(found);
    return {
      vangNapTuWeb: found.userGameStats.vangNapTuWeb,
      ngocNapTuWeb: found.userGameStats.ngocNapTuWeb
    };
  }

  @GrpcMethod('UserService', 'UpdateBalance')
  async updateBalance(data: UpdateBalanceRequest) {
    const found = await this.userService.findByAuthIdWithStats(data.id);
    if (!found) throw new RpcException({code: status.UNAUTHENTICATED ,message: 'User không tồn tại'});
    if (data.type === 'vangNapTuWeb') found.userGameStats.vangNapTuWeb = data.amount;
    else if (data.type === 'ngocNapTuWeb') found.userGameStats.ngocNapTuWeb = data.amount;
    else throw new RpcException({code: status.UNAUTHENTICATED ,message: 'Loại balance không hợp lệ'});
    await this.userService.saveUser(found);
    return {
      message: 'Cập nhật balance thành công!',
      vangNapTuWeb: found.userGameStats.vangNapTuWeb,
      ngocNapTuWeb: found.userGameStats.ngocNapTuWeb,
    };
  }

  @GrpcMethod(USER_SERVICE_NAME, 'AddVangNapTuWeb')
  async addVangNapTuWeb(data: AddBalanceRequest): Promise<BalanceResponse> {
    const found = await this.userService.findByAuthIdWithStats(data.id);
    if (!found) throw new RpcException({code: status.UNAUTHENTICATED ,message: 'User không tồn tại'});
    if (data.amount <= 0) throw new RpcException({code: status.UNAUTHENTICATED ,message: 'Số tiền phải lớn hơn 0'});
    found.userGameStats.vangNapTuWeb = Number(found.userGameStats.vangNapTuWeb) + Number(data.amount);
    await this.userService.saveUser(found);
    return {
      vangNapTuWeb: found.userGameStats.vangNapTuWeb,
      ngocNapTuWeb: found.userGameStats.ngocNapTuWeb
    };
  }

  @GrpcMethod(USER_SERVICE_NAME, 'AddNgocNapTuWeb')
  async addNgocNapTuWeb(data: AddBalanceRequest): Promise<BalanceResponse> {
    const found = await this.userService.findByAuthIdWithStats(data.id);
    if (!found) throw new RpcException({code: status.UNAUTHENTICATED ,message: 'User không tồn tại'});
    if (data.amount <= 0) throw new RpcException({code: status.UNAUTHENTICATED ,message: 'Số tiền phải lớn hơn 0'});
    found.userGameStats.ngocNapTuWeb = Number(found.userGameStats.ngocNapTuWeb) + Number(data.amount);
    await this.userService.saveUser(found);
    return {
      vangNapTuWeb: found.userGameStats.vangNapTuWeb,
      ngocNapTuWeb: found.userGameStats.ngocNapTuWeb
    };
  }

  // ========== TOP ==========
  @GrpcMethod(USER_SERVICE_NAME, 'GetTop10BySucManh')
  async getTop10BySucManh(): Promise<UserListResponse>  {
    const users = await this.userService.getTop10UsersBySucManh();
    return { users };
  }

  @GrpcMethod(USER_SERVICE_NAME, 'GetTop10ByVang')
  async getTop10ByVang(): Promise<UserListResponse> {
    const users = await this.userService.getTop10UsersByVang();
    return { users };
  }

  // ========== ITEM WEB ==========
  @GrpcMethod(USER_SERVICE_NAME, 'AddItemWeb')
  async addItemWeb(data: AddItemRequest): Promise<MessageResponse> {
    const { id : username, itemId } = data;
    if (!username || itemId == null)
      throw new RpcException({code: status.UNAUTHENTICATED ,message: 'Username hoặc itemId không tìm thấy'});

    const user = await this.userService.findByAuthIdWithItems(username);
    if (!user) throw new RpcException({code: status.UNAUTHENTICATED ,message: 'User không tồn tại'});
    if (!user.danhSachVatPhamWeb) user.danhSachVatPhamWeb = [];

    const payResp = await this.payService.getPay({userId: user.auth_id});
    const userBalance = Number(payResp.pay?.tien) || 0;

    const itemPrices = {
      1: 10000, 2: 20000, 3: 30000, 4: 40000, 5: 50000, 6: 60000, 7: 70000
    };
    const tienVatPham = itemPrices[itemId] ?? 0;

    if (tienVatPham > userBalance) {
      throw new RpcException({ code: status.FAILED_PRECONDITION, message: 'Số dư không đủ để mua đồ' });
    }
    // Tạo item mới
    const newItem = new User_Web_Item();
    newItem.item_id = itemId;
    newItem.price = tienVatPham;
    newItem.user = user;

    // Đảm bảo danh sách tồn tại
    if (!user.danhSachVatPhamWeb) user.danhSachVatPhamWeb = [];

    // Thêm vào danh sách
    user.danhSachVatPhamWeb.push(newItem);
    // Ghi item + outbox trong cùng 1 transaction
    // → đảm bảo: nếu crash sau transaction, cron sẽ retry trừ tiền
    // → nếu crash trước transaction commit, cả 2 đều không tồn tại → an toàn
    let savedItemId: number;
    await this.userRepository.manager.transaction(async (manager) => {
      await manager.save(User_Entity, user);
      savedItemId = newItem.id;
 
      const outbox = manager.create(BuyItemOutbox, {
        payload: {
          userId: user.auth_id,
          amount: -tienVatPham,
          // idempotencyKey gắn với itemId cụ thể → pay service dùng để chống double-charge
          idempotencyKey: `MUA_ITEM:${savedItemId}`,
        },
        status: 'PENDING',
        nextRetryAt: new Date(),
      });
      await manager.save(BuyItemOutbox, outbox);
    });
 
    // Fast path: trừ tiền ngay, không chờ cron
    // Không await — không block response về client
    // Cron là fallback nếu crash ở đây
    this.handleBuyItemPayment({
      userId: user.auth_id,
      amount: -tienVatPham,
      idempotencyKey: `MUA_ITEM:${savedItemId!}`,
    }).catch(() => {
      // lỗi đã được log trong handler, cron sẽ lo
    });
 
    return { message: `Đã thêm item ${itemId} cho user ${username}` };;
  }

  // ─── Fast path handler: trừ tiền sau khi item đã lưu ─────────────────────────
  // Tách ra method riêng thay vì @OnEvent để tái sử dụng cho cron
  async handleBuyItemPayment(payload: {
    userId: number;
    amount: number;
    idempotencyKey: string;
  }): Promise<void> {
    try {
      await this.payService.updateMoney({
        userId: payload.userId,
        amount: payload.amount,
        idempotencyKey: payload.idempotencyKey,
      });
 
      // Chỉ đánh DONE record khớp đúng idempotencyKey để tránh ảnh hưởng outbox khác
      await this.buyItemOutboxRepo.update(
        { payload: { idempotencyKey: payload.idempotencyKey } as any, status: 'PENDING' },
        { status: 'DONE' },
      );
    } catch (error) {
      console.warn(`[buy-item] fast path fail — cron sẽ retry`, error);
    }
  }
 
  // ─── CRON: Retry trừ tiền item ───────────────────────────────────────────────
  // Không có FAILED — bắt buộc phải trừ được vì item đã tồn tại trong DB
 
  @Cron(CronExpression.EVERY_5_SECONDS)
  async pollBuyItemOutbox(): Promise<void> {
    const events = await this.buyItemOutboxRepo.find({
      where: { status: 'PENDING', nextRetryAt: LessThanOrEqual(new Date()) },
      order: { createdAt: 'ASC' },
      take: 20,
    });
 
    for (const event of events) {
      // Optimistic lock: chỉ 1 instance xử lý mỗi event
      const result = await this.buyItemOutboxRepo.update(
        { id: event.id, status: 'PENDING' },
        { status: 'PROCESSING' },
      );
      if (result.affected === 0) continue;
 
      try {
        const payload = event.payload as {
          userId: number;
          amount: number;
          idempotencyKey: string;
        };
        await this.payService.updateMoney({
          userId: payload.userId,
          amount: payload.amount,
          idempotencyKey: payload.idempotencyKey,
        });
        await this.buyItemOutboxRepo.update(event.id, { status: 'DONE' });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const delayMs = Math.pow(2, Math.min(event.retries, 10)) * 5_000;
        await this.buyItemOutboxRepo.update(event.id, {
          status: 'PENDING',
          retries: event.retries + 1,
          nextRetryAt: new Date(Date.now() + delayMs),
          lastError: errorMessage,
        });
        console.warn(
          `[buy-item] retry ${event.retries + 1} key: ${(event.payload as any).idempotencyKey}`,
        );
 
        if (event.retries >= 10) {
          console.error(`[buy-item] CRITICAL retry ${event.retries} — Pay Service có vấn đề?`, {
            idempotencyKey: (event.payload as any).idempotencyKey,
            errorMessage,
          });
          // TODO: alert Discord
        }
      }
    }
  }
 
  // ─── CRON: Recover stuck PROCESSING (buy-item) ───────────────────────────────
 
  @Cron('*/30 * * * * *')
  async recoverStuckProcessingBuyItem(): Promise<void> {
    const stuckThreshold = new Date(Date.now() - 5 * 60_000);
    await this.buyItemOutboxRepo.update(
      { status: 'PROCESSING', updatedAt: LessThanOrEqual(stuckThreshold) },
      { status: 'PENDING' },
    );
  }

  @GrpcMethod(USER_SERVICE_NAME, 'GetItemsWeb')
  async getItemsWeb(data: UsernameRequest): Promise<ItemListResponse> {
    const user = await this.userService.findByAuthIdWithItems(data.id);
    if (!user) throw new RpcException({code: status.UNAUTHENTICATED ,message: 'User không tồn tại'});
    return { 
      itemWebs: user.danhSachVatPhamWeb.map(i => ({
        itemId: i.item_id,
        price: i.price
      }))
    };
  }

  @GrpcMethod(USER_SERVICE_NAME, 'UseItemWeb')
  async useItemWeb(data: UseItemRequest): Promise<UseItemResponse> {
    const { id : username, itemIds } = data;
    const user = await this.userService.findByAuthIdWithItems(username);
    if (!user) throw new RpcException({code: status.UNAUTHENTICATED ,message: 'User không tồn tại'});

    // Đếm số lượng từng itemId client yêu cầu: { 1: 4, 2: 1, ... }
    const requestedCounts = itemIds.reduce<Record<number, number>>(
      (counts, id) => {
        counts[id] = (counts[id] ?? 0) + 1;
        return counts;
      },
      {}
    );

    // Với mỗi itemId, lấy đúng số lượng record cần xóa
    const recordsToDelete: number[] = [];

    for (const [itemId, count] of Object.entries(requestedCounts)) {
      const matchingRecords = user.danhSachVatPhamWeb
        .filter(i => i.item_id == Number(itemId))
        .slice(0, count); // lấy đúng số lượng cần

      if (matchingRecords.length < count) {
        throw new RpcException({
          code: status.FAILED_PRECONDITION,
          message: `User không đủ item ${itemId}: cần ${count}, có ${matchingRecords.length}`,
        });
      }

      recordsToDelete.push(...matchingRecords.map(r => r.id));
    }

    // Xóa tất cả trong 1 lần, nếu fail thì không partial delete
    await this.userWebItemService.deleteManyByIds(recordsToDelete);

    return {
      successItemIds: itemIds, // trả lại đúng list itemIds đã dùng
    };
  }

  @GrpcMethod(USER_SERVICE_NAME, 'GetPosition')
  async GetPosition(data: GetPositionRequest): Promise<GetPositionResponse> {
    const userPositionData = await this.userPosition.getPosition(data);
    const user = await this.userService.findByAuthIdWithStatsAndPosition(data.userId);
    let result;
    if (user) {
      result = {
        map: userPositionData.map,
        x: userPositionData.x,
        y: userPositionData.y,
        gameName: user.gameName
      }
    }
    return result;
  }

  @GrpcMethod(USER_SERVICE_NAME, 'SavePosition')
  async SavePosition(data: SavePositionRequest): Promise<SavePositionResponse> {
    return this.userPosition.savePosition(data)
  }
}