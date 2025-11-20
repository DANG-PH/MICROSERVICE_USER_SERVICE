import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User_Entity } from './user.entity';
import * as bcrypt from 'bcrypt';
import { UserGameStatsService } from 'src/service-trong/user-game-stats/user-game-stats.service';
import { User } from 'proto/user.pb';

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
    return await this.userRepository.find();
  }

  // kiểm tra tồn tại Auth Id
  async existsByAuthId(authId: number): Promise<boolean> {
    const count = await this.userRepository.count({ where: { auth_id: authId } });
    return count > 0;
    }

  // tìm user theo Auth Id
  async findByAuthId(authId: number): Promise<User_Entity | null> {
    return await this.userRepository.findOne({ where: { auth_id: authId } });
  }

  // top 10 sức mạnh
  async getTop10UsersBySucManh(): Promise<User[]> {
    const stats = await this.userGameStatsService.getTop10UsersBySucManh();
    return stats.map(s => ({
      ...s,
      ...s.user.userPosition,
      ...s.user,
      id: s.user.id,
      danhSachVatPhamWeb: s.user.danhSachVatPhamWeb.map(i => i.item_id),
      auth_id: Number(s.user.auth_id),
    }));
  }

  // top 10 vàng
  async getTop10UsersByVang(): Promise<User[]> {
    const stats = await this.userGameStatsService.getTop10UsersByVang();
    return stats.map(s => ({
      ...s,
      ...s.user.userPosition,
      ...s.user,
      id: s.user.id,
      danhSachVatPhamWeb: s.user.danhSachVatPhamWeb.map(i => i.item_id),
      auth_id: Number(s.user.auth_id),
    }));
  }
}