import { join } from 'path';
import { ServeStaticModule } from '@nestjs/serve-static';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventsModule } from './events/events.module';
// eslint-disable-next-line import/extensions
import { config } from './config/configuration';

@Module({
    imports: [
        ConfigModule.forRoot({
            load: [config],
        }),
        ServeStaticModule.forRoot({
            rootPath: join(__dirname, '..', 'client', 'public'),
        }),
        EventsModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
