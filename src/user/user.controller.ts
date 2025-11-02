import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { UserService } from './user.service';
import { UserWebItemService } from 'src/user-web-item/user-web-item.service';
import { User_Entity } from './user.entity';
import { User_Game_Stats } from 'src/user-game-stats/user-game-stats.entity';
import { User_Position } from 'src/user-position/user-positon.entity';
import type {User,GetUserRequest, UserResponse, AddBalanceRequest, BalanceResponse, AddItemRequest, MessageResponse, UsernameRequest, ItemListResponse, UseItemRequest, UserListResponse, RegisterResponse, RegisterRequest, UseBalanceRequest, UpdateBalanceRequest } from 'proto/user.pb';
import { USER_SERVICE_NAME } from 'proto/user.pb';
import { User_Web_Item } from 'src/user-web-item/user-web-item.entity';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';

@Controller()
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly userWebItemService: UserWebItemService,
  ) {}

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
    await this.userService.saveUser(userMoi);
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
  async saveGame(data: { user: User; sucManhDeTu: number }) {
    const { user, sucManhDeTu } = data;
    const found = await this.userService.findByAuthId(user.auth_id);
    if (!found) throw new RpcException({code: status.UNAUTHENTICATED ,message: 'User không tồn tại'});

    found.userGameStats.vang = user.vang;
    found.userGameStats.ngoc = user.ngoc;
    found.userGameStats.sucManh = user.sucManh;
    found.userPosition.x = user.x;
    found.userPosition.y = user.y;
    found.userPosition.mapHienTai = user.mapHienTai;
    found.userGameStats.coDeTu = user.coDeTu;

    if (found.userGameStats.coDeTu) {
    //   try {
    //     const url = `http://localhost:3002/detu/saveGame/${user.username}`;
    //     await firstValueFrom(this.httpService.post(url, { sucManh: sucManhDeTu }));
    //     console.log('✅ Gửi dữ liệu đệ tử sang DeTuService');
    //   } catch (error) {
    //     console.error('❌ Lỗi khi gọi DeTuService:', error.message);
    //     throw new InternalServerErrorException('Không thể lưu dữ liệu đệ tử');
    //   }
    }

    await this.userService.saveUser(found);
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
    if (found.userGameStats.vangNapTuWeb < Number(data.amount)) throw new RpcException({code: status.UNAUTHENTICATED ,message: `Không đủ ngọc nạp, ngọc nạp hiện có: ${found.userGameStats.vangNapTuWeb}`});
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
    // Tạo item mới
    const newItem = new User_Web_Item();
    newItem.item_id = itemId;
    newItem.user = user;

    // Đảm bảo danh sách tồn tại
    if (!user.danhSachVatPhamWeb) user.danhSachVatPhamWeb = [];

    // Thêm vào danh sách
    user.danhSachVatPhamWeb.push(newItem);
    await this.userService.saveUser(user);
    return { message: `Đã thêm item ${itemId} cho user ${username}` };
  }

  @GrpcMethod(USER_SERVICE_NAME, 'GetItemsWeb')
  async getItemsWeb(data: UsernameRequest): Promise<ItemListResponse> {
    const user = await this.userService.findByAuthId(data.id);
    if (!user) throw new RpcException({code: status.UNAUTHENTICATED ,message: 'User không tồn tại'});
    return { itemIds: user.danhSachVatPhamWeb.map(i => i.item_id) };
  }

  @GrpcMethod(USER_SERVICE_NAME, 'UseItemWeb')
  async useItemWeb(data: UseItemRequest): Promise<MessageResponse> {
    const { id : username, itemId } = data;
    const user = await this.userService.findByAuthId(username);
    if (!user) throw new RpcException({code: status.UNAUTHENTICATED ,message: 'User không tồn tại'});

    console.log('danhSachVatPhamWeb:', user.danhSachVatPhamWeb);
    const item = user.danhSachVatPhamWeb.find(i => i.item_id == itemId);
    if (!item) throw new RpcException({code: status.UNAUTHENTICATED ,message: `User không có item ${itemId}`});

    await this.userWebItemService.deleteById(item.id);

    return { message: `Đã sử dụng item ${itemId} cho user ${username}` };
  }
}