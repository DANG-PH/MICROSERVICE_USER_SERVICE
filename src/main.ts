import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { Logger } from '@nestjs/common';
import { USER_PACKAGE_NAME } from 'proto/user.pb';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  // ✅ gRPC (RPC interface)
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: USER_PACKAGE_NAME,
      protoPath: join(process.cwd(), 'proto/user.proto'),
      url: process.env.USER_URL,
      loader: {
        keepCase: true,
        objects: true,
        arrays: true,
      },
    },
  });

  // ✅ RMQ (event consumer)
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [String(process.env.RABBIT_URL)],
      queue: process.env.RABBIT_QUEUE,
      queueOptions: { durable: true },
    },
  });

  // start ALL microservices (gRPC + RMQ)
  await app.startAllMicroservices();

  logger.log(`✅ gRPC server running on ${process.env.USER_URL}`);
  logger.log(`✅ RMQ consumer listening on ${process.env.RABBIT_QUEUE}`);

  // HTTP (optional)
  await app.listen(Number(process.env.PORT));
  logger.log(`✅ HTTP server running on ${process.env.PORT}`);
}

bootstrap();
