import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { Logger } from '@nestjs/common';
import { USER_PACKAGE_NAME } from 'proto/user.pb';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: USER_PACKAGE_NAME,
      protoPath: join(process.cwd(), 'proto/user.proto'), 
      url: '0.0.0.0:50052', 
      loader: {
        keepCase: true,
        objects: true,
        arrays: true,
      },
    },
  });

  await app.startAllMicroservices();
  logger.log('✅ gRPC server running on localhost:50052');

  await app.listen(process.env.PORT ?? 3004);
  logger.log(`✅ HTTP server running on ${process.env.PORT ?? 3004}`);
}

bootstrap();
