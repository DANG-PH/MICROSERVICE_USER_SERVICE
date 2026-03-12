import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User_Position } from './user-positon.entity';
import { GetPositionRequest, GetPositionResponse, SavePositionRequest, SavePositionResponse } from 'proto/user.pb';

@Injectable()
export class UserPositionService {
  constructor(
    @InjectRepository(User_Position)
    private readonly positionRepository: Repository<User_Position>,
  ) {}

  async getPosition(payload: GetPositionRequest): Promise<GetPositionResponse> {
    const position = await this.positionRepository.findOne({
      where: {
        user: {
          id: payload.userId,
        },
      },
      relations: ['user'],
    });
  
    if (!position) {
      throw new Error('User position not found');
    }
  
    return {
      x: position.x,
      y: position.y,
      map: position.mapHienTai,
      gameName: ""
    };
  }

  async savePosition(payload: SavePositionRequest): Promise<SavePositionResponse> {
    const position = await this.positionRepository.findOne({
        where: {
          user: {
            id: payload.userId,
          },
        },
        relations: ['user'],
    });

    if (!position) {
        throw new Error('User position not found');
    }

    position.x = payload.x;
    position.y = payload.y;
    position.mapHienTai = payload.map;

    await this.positionRepository.save(position);

    return {
        success: true
    };
  }
}
