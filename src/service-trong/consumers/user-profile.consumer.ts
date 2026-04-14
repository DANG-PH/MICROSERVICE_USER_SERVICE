import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { UserService } from '../user/user.service';

@Controller()
export class UserProfileConsumer {
  constructor(private readonly userService: UserService) {}

  @EventPattern('UserProfileUpdated')
  async handleUserProfileUpdated(
    @Payload() data: { userId: number; avatarUrl: string },
  ) {
    await this.userService.updateAvatar(data.userId, data.avatarUrl);
  }
}