import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User_Entity } from './user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserGameStatsModule } from 'src/service-trong/user-game-stats/user-game-stats.module';
import { UserWebItemModule } from 'src/service-trong/user-web-item/user-web-item.module';
import { UserPositionModule } from 'src/service-trong/user-position/user-postion.module';
import { DeTuModule } from 'src/service-ngoai/detu/detu.module';
import { PayModule } from 'src/service-ngoai/pay/pay.module';

@Module({
  imports: [TypeOrmModule.forFeature([User_Entity]),UserGameStatsModule,UserWebItemModule,UserPositionModule, DeTuModule, PayModule], // Kết nối entity User
  providers: [UserService],                  // Service sẽ được inject
  controllers: [UserController],            // Controller xử lý API
  exports: [UserService],
})
export class UserModule {}
