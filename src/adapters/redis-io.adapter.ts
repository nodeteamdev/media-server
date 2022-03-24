import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

export class RedisIoAdapter extends IoAdapter {
    private adapterConstructor: ReturnType<typeof createAdapter>;

    async connectToRedis(): Promise<void> {
        const pubClient = createClient({
            url: 'redis://redis-11668.c258.us-east-1-4.ec2.cloud.redislabs.com:11668',
            password: 'C3EJHyjoVUK5J5IMmRddznRWYPLFSjRj',
        });
        const subClient = pubClient.duplicate();

        await pubClient.connect();
        await subClient.connect();

        this.adapterConstructor = createAdapter(pubClient, subClient);
    }

    createIOServer(port: number, options?: ServerOptions): any {
        const server = super.createIOServer(port, options);

        server.adapter(this.adapterConstructor);

        return server;
    }
}
