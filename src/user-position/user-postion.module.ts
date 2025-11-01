import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User_Position } from './user-positon.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User_Position])], 
  providers: [],                  
  controllers: [],            
  exports: [],
})
export class UserPositionModule {}
