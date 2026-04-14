import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User_Entity } from './user.entity';
import * as bcrypt from 'bcrypt';
import { UserGameStatsService } from 'src/service-trong/user-game-stats/user-game-stats.service';
import { User, UserBxh } from 'proto/user.pb';

//UserService: quản lý user, CRUD, update stats.
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User_Entity)
    private readonly userRepository: Repository<User_Entity>,
    
    private readonly userGameStatsService: UserGameStatsService,
  ) {}

  // lưu user (insert hoặc update tùy id)
  async saveUser(user: User_Entity): Promise<User_Entity> {
    return await this.userRepository.save(user);
  }

  // lấy toàn bộ user
  async getAllUsers(): Promise<User_Entity[]> {
    return await this.userRepository.find({
      relations: ['userGameStats', 'userPosition', 'danhSachVatPhamWeb']
    });
  }

  // kiểm tra tồn tại Auth Id
  async existsByAuthId(authId: number): Promise<boolean> {
    const count = await this.userRepository.count({ where: { auth_id: authId } });
    return count > 0;
    }

  // tìm user theo Auth Id
  // Chỉ cần stats — GetBalance, UseVang, UseNgoc, UpdateBalance, AddVang, AddNgoc
  async findByAuthIdWithStats(authId: number) {
    return this.userRepository.findOne({
      where: { auth_id: authId },
      relations: ['userGameStats'],
    });
  }

  // Cần stats + position — SaveGame
  async findByAuthIdWithStatsAndPosition(authId: number) {
    return this.userRepository.findOne({
      where: { auth_id: authId },
      relations: ['userGameStats', 'userPosition'],
    });
  }

  // Cần tất cả — GetProfile, AddItemWeb, GetItemsWeb, UseItemWeb
  async findByAuthIdFull(authId: number) {
    return this.userRepository.findOne({
      where: { auth_id: authId },
      relations: ['userGameStats', 'userPosition', 'danhSachVatPhamWeb'],
    });
  }

  async findByAuthIdWithItems(authId: number) {
    return this.userRepository.findOne({
      where: { auth_id: authId },
      relations: ['danhSachVatPhamWeb'],
    });
  }

  // top 10 sức mạnh
  async getTop10UsersBySucManh(): Promise<UserBxh[]> {
    const stats = await this.userGameStatsService.getTop10UsersBySucManhRelations();
    return stats.map(s => ({
      vang: s.vang,
      ngoc: s.ngoc,
      sucManh: s.sucManh,
      gameName: s.user.gameName,
      avatarUrl: s.user.avatarUrl,
    }));
  }

  // top 10 vàng
  async getTop10UsersByVang(): Promise<UserBxh[]> {
    const stats = await this.userGameStatsService.getTop10UsersByVangRelations();
    return stats.map(s => ({
      vang: s.vang,
      ngoc: s.ngoc,
      sucManh: s.sucManh,
      gameName: s.user.gameName,
      avatarUrl: s.user.avatarUrl,
    }));
  }

  async updateAvatar(authId: number, avatarUrl: string): Promise<void> {
    await this.userRepository.update(
      { auth_id: authId },
      { avatarUrl }
    );
  }
}