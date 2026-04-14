import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { UserModule } from '../user/user.module';
import { UserProfileConsumer } from './user-profile.consumer';

@Module({
  imports: [UserModule],
  providers: [],
  controllers: [UserProfileConsumer],
})
export class ConsumerModule {}

