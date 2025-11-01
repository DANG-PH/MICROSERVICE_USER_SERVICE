import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User_Game_Stats } from './user-game-stats.entity';
import { UserGameStatsService } from './user-game-stats.service';

@Module({
  imports: [TypeOrmModule.forFeature([User_Game_Stats])], 
  providers: [UserGameStatsService],                  
  controllers: [],            
  exports: [UserGameStatsService],
})
export class UserGameStatsModule {}
