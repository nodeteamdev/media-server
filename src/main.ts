import { readFileSync } from 'fs';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './adapters/redis-io.adapter';

const PORT = process.env.PORT || 3000;

(async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    app.setBaseViewsDir(join(__dirname, '..', 'client', 'views'));
    app.setViewEngine('hbs');

    const redisIoAdapter = new RedisIoAdapter(app);
    await redisIoAdapter.connectToRedis();

    app.useWebSocketAdapter(redisIoAdapter);

    await app.listen(PORT, '0.0.0.0', () => {
        console.log(`APP started on port ${PORT}`);
    });
}());
