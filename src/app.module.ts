import { join } from 'path';

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventsModule } from './events/events.module';
// eslint-disable-next-line import/extensions
import { config } from './config/configuration';
import { RoomModule } from './room/room.module';

@Module({
    imports: [
        MongooseModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                uri: configService.get<string>('mongodb.url'),
            }),
            inject: [ConfigService],
        }),
        ConfigModule.forRoot({
            load: [config],
        }),
        ServeStaticModule.forRoot({
            rootPath: join(__dirname, '..', 'client', 'public'),
        }),
        EventsModule,
        RoomModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
