import { Controller } from '@nestjs/common';
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

@Controller()
export class UserController {
  private redis: Redis;
  constructor(
    private readonly userService: UserService,
    private readonly userWebItemService: UserWebItemService,
    private readonly deTuService: DeTuService,
    private readonly payService: PayService,
    private readonly userPosition: UserPositionService,
  ) {
    this.redis = new Redis(process.env.REDIS_URL || '')
  }

  // ========== REGISTER ==========
  @GrpcMethod(USER_SERVICE_NAME, 'Register')
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    const exists = await this.userService.existsByAuthId(data.id);
    if (exists) return { success: false };
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
    const user = await this.userService.saveUser(userMoi);

    await this.payService.createPay({userId: user.auth_id});

    return { success: true };
  }

  // ========== PROFILE ==========
  @GrpcMethod(USER_SERVICE_NAME, 'GetProfile')
  async getProfile(data: GetUserRequest) : Promise<UserResponse> {
    const user = await this.userService.findByAuthId(data.id);
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
    const found = await this.userService.findByAuthId(user.auth_id);
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
    const found = await this.userService.findByAuthId(data.id);
    if (!found) throw new RpcException({code: status.UNAUTHENTICATED ,message: 'User không tồn tại'});
    return {
      vangNapTuWeb: found.userGameStats.vangNapTuWeb,
      ngocNapTuWeb: found.userGameStats.ngocNapTuWeb,
    };
  }

  @GrpcMethod('UserService', 'UseVangNapTuWeb')
  async useVangNapTuWeb(data: UseBalanceRequest): Promise<BalanceResponse> {
    const found = await this.userService.findByAuthId(data.id);
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
    const found = await this.userService.findByAuthId(data.id);
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
    const found = await this.userService.findByAuthId(data.id);
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
    const found = await this.userService.findByAuthId(data.id);
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
    const found = await this.userService.findByAuthId(data.id);
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

    const user = await this.userService.findByAuthId(username);
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
    await this.userService.saveUser(user);
    await this.payService.updateMoney({userId: user.auth_id, amount: 0-tienVatPham})
    return { message: `Đã thêm item ${itemId} cho user ${username}` };
  }

  @GrpcMethod(USER_SERVICE_NAME, 'GetItemsWeb')
  async getItemsWeb(data: UsernameRequest): Promise<ItemListResponse> {
    const user = await this.userService.findByAuthId(data.id);
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
    const user = await this.userService.findByAuthId(username);
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
    const user = await this.userService.findByAuthId(data.userId);
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