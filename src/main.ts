import { readFileSync } from 'fs';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './adapters/redis-io.adapter';

const httpsOptions = {
    key: readFileSync(join(__dirname, '..', '/secrets/localhost.key'), 'utf8'),
    cert: readFileSync(join(__dirname, '..', '/secrets/localhost.crt'), 'utf8'),
};

(async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
        httpsOptions,
    });

    app.setBaseViewsDir(join(__dirname, '..', 'client', 'views'));
    app.setViewEngine('hbs');

    const redisIoAdapter = new RedisIoAdapter(app);
    await redisIoAdapter.connectToRedis();

    app.useWebSocketAdapter(redisIoAdapter);

    await app.listen(3000);
}());
