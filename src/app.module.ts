import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './service-trong/user/user.module';
import { UserGameStatsModule } from './service-trong/user-game-stats/user-game-stats.module';
import { UserPositionModule } from './service-trong/user-position/user-postion.module';
import { UserWebItemModule } from './service-trong/user-web-item/user-web-item.module';
import { DeTuModule } from './service-ngoai/detu/detu.module';
import { PayModule } from './service-ngoai/pay/pay.module';
import { RedisModule } from './redis/redis.module';
import { ConsumerModule } from './service-trong/consumers/consumer.module';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,           
      envFilePath: '.env',     
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true, 
      extra: {
        connectionLimit: 30,   
      }
    }),
    EventEmitterModule.forRoot(), 
    UserModule,
    UserGameStatsModule,
    UserPositionModule,
    UserWebItemModule,
    DeTuModule,
    PayModule,
    RedisModule,
    ConsumerModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
