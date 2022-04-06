import { readFileSync } from 'fs';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './modules/app.module';
import { RedisIoAdapter } from './adapters/redis-io.adapter';
import AllExceptionsFilter from './core/filters/all-exeption.filter';
import BaseWsExceptionFilter from './core/filters/ws-exceptions.filter';
import NotFoundExceptionFilter from './core/filters/not-found.exception.filter';

const PORT = process.env.PORT || 3000;

const httpsOptions = {
    key: readFileSync(join(__dirname, '..', '/secrets/localhost.key'), 'utf8'),
    cert: readFileSync(join(__dirname, '..', '/secrets/localhost.crt'), 'utf8'),
};

(async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
        httpsOptions,
    });

    app.useGlobalPipes(new ValidationPipe({
        transform: true,
    }));

    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalFilters(new BaseWsExceptionFilter());
    app.useGlobalFilters(new NotFoundExceptionFilter());

    app.setBaseViewsDir(join(__dirname, '..', 'client', 'views'));
    app.setViewEngine('hbs');

    const redisIoAdapter = new RedisIoAdapter(app);
    await redisIoAdapter.connectToRedis();

    app.useWebSocketAdapter(redisIoAdapter);

    await app.listen(PORT, '0.0.0.0', () => {
        console.log(`APP started on port ${PORT}`);
    });
}());
