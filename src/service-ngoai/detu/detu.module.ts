import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { DETU_PACKAGE_NAME } from 'proto/detu.pb';
import { DeTuService } from './detu.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: DETU_PACKAGE_NAME,
        transport: Transport.GRPC,
        options: {
          package: DETU_PACKAGE_NAME,
          protoPath: join(process.cwd(), 'proto/detu.proto'),
          url: process.env.DETU_URL,
          loader: {
                keepCase: true,
                objects: true,
                arrays: true,
          },
        },
      },
    ]),
  ],
  controllers: [],
  providers: [DeTuService],
  exports: [DeTuService]
})
export class DeTuModule {}
