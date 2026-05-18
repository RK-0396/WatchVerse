import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: ['https://stony-hardener-emergency.ngrok-free.dev'] });
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
