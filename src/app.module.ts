import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './user/user.module';
import { UserGameStatsModule } from './user-game-stats/user-game-stats.module';
import { UserPositionModule } from './user-position/user-postion.module';
import { UserWebItemModule } from './user-web-item/user-web-item.module';
import { DeTuModule } from './detu/detu.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,           
      envFilePath: '.env',     
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3307,
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true, 
    }),
    UserModule,
    UserGameStatsModule,
    UserPositionModule,
    UserWebItemModule,
    DeTuModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
