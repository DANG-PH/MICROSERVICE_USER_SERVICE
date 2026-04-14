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

          // Nếu dùng thì phải đổi sang take
          // vì limit kia nó chỉ lấy đc vài user do nó chỉ lấy theo row
          // Phải dùng take ở tầng typeORM
          // Vì có quan hệ 1-N
          // Nên nó trả nhiều row sau leftJoin nên limit 10 bị sai
          // Còn take thì không
          // 1-1 thì số row sau join bằng đúng số user, số limit 10 luôn đúng
          // Nếu cả position cũng là 1-N thì số row sẽ là N*N
          // Nhưng may ở đây là positon 1-1 user


          // InnerJoin
          // → chỉ lấy stats có user tương ứng
          // → stats không có user → bị loại
          // Hợp lý vì stats không thể tồn tại không có user

          // LeftJoin
          // → lấy tất cả user dù có item hay không
          // → user không có item → vẫn xuất hiện, items = []
          // Hợp lý vì user mới chưa mua item nào vẫn phải có trong top 10
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

  // Cách relations
  // Đọc comment ở trên, cái này dùng take nên đã giải quyết được vụ 1-n
  async getTop10UsersBySucManhRelations() {
    return this.statsRepository.find({
      relations: ['user', 'user.userPosition','user.danhSachVatPhamWeb'],
      order: { sucManh: 'DESC' },
      take: 10,
    });
  }

  async getTop10UsersByVangRelations() {
    return this.statsRepository.find({
      relations: ['user', 'user.userPosition','user.danhSachVatPhamWeb'],
      order: { vang: 'DESC' },
      take: 10,
    });
  }

  // 2 cách trên nếu muốn lấy full user, còn nếu chỉ muốn lấy stat thì dùng hàm dưới
  async getTop10UsersBySucManhStats() {
    return this.statsRepository.find({
      relations: ['user'],
      order: { sucManh: 'DESC' },
      take: 10,
    });
  }

  async getTop10UsersByVangStats() {
    return this.statsRepository.find({
      relations: ['user'],
      order: { vang: 'DESC' },
      take: 10,
    });
  }
}
