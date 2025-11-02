import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User_Entity } from './user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserGameStatsModule } from 'src/user-game-stats/user-game-stats.module';
import { UserWebItemModule } from 'src/user-web-item/user-web-item.module';
import { UserPositionModule } from 'src/user-position/user-postion.module';

@Module({
  imports: [TypeOrmModule.forFeature([User_Entity]),UserGameStatsModule,UserWebItemModule,UserPositionModule], // Kết nối entity User
  providers: [UserService],                  // Service sẽ được inject
  controllers: [UserController],            // Controller xử lý API
  exports: [UserService],
})
export class UserModule {}
