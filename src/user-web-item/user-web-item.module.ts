import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User_Web_Item } from './user-web-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User_Web_Item])], 
  providers: [],                  
  controllers: [],            
  exports: [],
})
export class UserWebItemModule {}
