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

  // Top 10 theo sức mạnh
  async getTop10UsersBySucManh(): Promise<User_Game_Stats[]> {
    return await this.statsRepository.find({
      order: { sucManh: 'DESC' },
      take: 10,
      relations: ['user']
    });
  }

  // Top 10 theo vàng
  async getTop10UsersByVang(): Promise<User_Game_Stats[]> {
    return await this.statsRepository.find({
      order: { vang: 'DESC' },
      take: 10,
      relations: ['user']
    });
  }
}
