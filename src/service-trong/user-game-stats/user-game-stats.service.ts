import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User_Game_Stats } from './user-game-stats.entity';

@Injectable()
export class UserGameStatsService {
  constructor(
    @InjectRepository(User_Game_Stats)
    private readonly statsRepository: Repository<User_Game_Stats>,
  ) {}

  // Lấy toàn bộ user stats
  async getAllUsers(): Promise<User_Game_Stats[]> {
    return await this.statsRepository.find();
  }

  async getTop10UsersBySucManh() {
    return this.statsRepository                        // bắt đầu từ bảng user_game_stats
          .createQueryBuilder('stats')              // đặt alias là 'stats'
          .innerJoinAndSelect('stats.user', 'user') // JOIN users ON user.id = stats.userId
                                                    // + SELECT luôn vào kết quả
          .innerJoinAndSelect('user.userPosition', 'position') // JOIN user_position
          .leftJoinAndSelect('user.danhSachVatPhamWeb', 'items') // LEFT JOIN items
                                                    // (left vì user có thể không có item)
          .orderBy('stats.sucManh', 'DESC')        // ORDER BY sucManh DESC
          .limit(10)                               // LIMIT 10
          .getMany()  
  }

  async getTop10UsersByVang() {
    return this.statsRepository
      .createQueryBuilder('stats')
      .innerJoinAndSelect('stats.user', 'user')
      .innerJoinAndSelect('user.userPosition', 'position')
      .leftJoinAndSelect('user.danhSachVatPhamWeb', 'items')
      .orderBy('stats.vang', 'DESC')
      .limit(10)
      .getMany();
  }
}
