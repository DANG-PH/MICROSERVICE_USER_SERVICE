import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User_Web_Item } from './user-web-item.entity';

@Injectable()
export class UserWebItemService {
  constructor(
    @InjectRepository(User_Web_Item)
    private readonly itemRepository: Repository<User_Web_Item>,
  ) {}
  async deleteById(id: number) {
    await this.itemRepository.delete(id);
  }

  async deleteManyByIds(ids: number[]): Promise<void> {
    await this.itemRepository.delete({ id: In(ids) }); // TypeORM In()
  }
}
