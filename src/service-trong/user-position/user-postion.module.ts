import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User_Position } from './user-positon.entity';
import { UserPositionService } from './user-position.service';

@Module({
  imports: [TypeOrmModule.forFeature([User_Position])], 
  providers: [UserPositionService],                  
  controllers: [],            
  exports: [UserPositionService],
})
export class UserPositionModule {}
