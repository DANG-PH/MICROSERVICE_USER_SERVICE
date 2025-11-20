import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User_Web_Item } from './user-web-item.entity';
import { UserWebItemService } from './user-web-item.service';

@Module({
  imports: [TypeOrmModule.forFeature([User_Web_Item])], 
  providers: [UserWebItemService],                  
  controllers: [],            
  exports: [UserWebItemService],
})
export class UserWebItemModule {}
