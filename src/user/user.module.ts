import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User_Entity } from './user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserGameStatsModule } from 'src/user-game-stats/user-game-stats.module';

@Module({
  imports: [TypeOrmModule.forFeature([User_Entity]),UserGameStatsModule], // Kết nối entity User
  providers: [UserService],                  // Service sẽ được inject
  controllers: [UserController],            // Controller xử lý API
  exports: [UserService],
})
export class UserModule {}
