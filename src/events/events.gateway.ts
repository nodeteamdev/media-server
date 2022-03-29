import {
    MessageBody,
    ConnectedSocket,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import * as ip from 'ip';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { types } from 'mediasoup';
import { Worker } from './worker';
import { Room } from './room';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
    namespace: 'mediasoup',
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
        server: Server;

    private logger: Logger = new Logger('AppGateway');

    public worker: types.Worker;

    constructor(private configService: ConfigService) {
        const mediasoupSettings = this.configService.get('mediasoup');

        new Worker(mediasoupSettings).startWorker().then(async (worker) => {
            this.worker = worker;
        });
    }

    @SubscribeMessage('join')
    async onJoin(@ConnectedSocket() client: Socket, @MessageBody() data: any): Promise<any> {
        const _client = client;
        const { roomId } = data;
        const { id: socketId } = _client;
        const mediasoupSettings = this.configService.get('mediasoup');

        const room = await Room.joinClient(roomId, socketId);

        if (room.router === null) {
            room.router = await Room.createRouter(
                this.worker,
                mediasoupSettings.router.mediaCodecs,
            );
        }

        _client.join(roomId);

        _client.data = {
            roomId,
            socketId,
        };

        this.logger.debug(`Client ${socketId} joined room ${roomId}`);

        return {
            socketId,
            roomId,
        };
    }

    @SubscribeMessage('getRtpCapabilities')
    async getRtpCapabilities(@ConnectedSocket() client: Socket) {
        const { roomId } = client.data;
        const { router } = await Room.getRoom(roomId);

        return {
            rtpCapabilities: router.rtpCapabilities,
        };
    }

    @SubscribeMessage('createWebRtcTransport')
    async createWebRtcTransport(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { sender: boolean; },
    ) {
        const { id: socketId } = client;
        const { roomId } = client.data;
        const { router } = await Room.getRoom(roomId);

        if (data.sender) {
            const { transport, params } = await this._createWebRtcTransport(router);

            Room.setProducerTransport(socketId, transport);

            return { params };
        }

        const { transport, params } = await this._createWebRtcTransport(router);

        Room.setConsumerTransport(socketId, transport);

        return { params };
    }

    @SubscribeMessage('transport-connect')
    async transportConnect(@MessageBody() { dtlsParameters }, @ConnectedSocket() client: Socket) {
        const { id: socketId } = client;
        this.logger.debug('transport connect dtlsParameters sent');

        const producerTransport = Room.getProducerTransport(socketId);

        await producerTransport.connect({ dtlsParameters });
    }

    @SubscribeMessage('transport-recv-connect')
    async transportRecvConnect(
        @MessageBody() { dtlsParameters },
        @ConnectedSocket() client: Socket,
    ) {
        const { id: socketId } = client;

        this.logger.debug('transport recv connect:');
        this.logger.debug(dtlsParameters);

        const consumerTransport = Room.getConsumerTransport(socketId);

        await consumerTransport.connect({ dtlsParameters });
    }

    @SubscribeMessage('transport-produce')
    async transportProduce(
        @MessageBody() { kind, rtpParameters },
        @ConnectedSocket() client: Socket,
    ) {
        const { id: socketId } = client;
        const { roomId } = client.data;

        const producerTransport = Room.getProducerTransport(socketId);

        const producer = await producerTransport.produce({
            kind,
            rtpParameters,
        });

        Room.setProducer(roomId, producer);

        this.logger.debug(`producer id: ${producer.id}, producer kind: ${producer.kind}`);

        producer.on('transportclose', () => {
            this.logger.debug(`transport for this producer ${producer.id} closed`);

            producer.close();
        });

        return {
            id: producer.id,
        };
    }

    @SubscribeMessage('consume')
    async consume(@MessageBody() { rtpCapabilities }, @ConnectedSocket() client: Socket) {
        const { roomId } = client.data;
        const { router } = await Room.getRoom(roomId);
        const { id: socketId } = client;

        const consumerTransport = Room.getConsumerTransport(socketId);
        const producer = Room.getProducer(roomId);

        try {
            if (router.canConsume({
                producerId: producer.id,
                rtpCapabilities,
            })) {
                const consumer = await consumerTransport.consume({
                    producerId: producer.id,
                    rtpCapabilities,
                    paused: true,
                });

                Room.setConsumer(socketId, consumer);

                consumer.on('transportclose', () => {
                    this.logger.debug('transport close from consumer');
                });

                consumer.on('producerclose', () => {
                    this.logger.debug('producer of consumer closed');
                });

                return {
                    params: {
                        id: consumer.id,
                        producerId: consumer.id,
                        kind: consumer.kind,
                        rtpParameters: consumer.rtpParameters,
                    },
                };
            }

            return {
                params: {
                    error: 'Router can not consume. Please check rtpCapabilities.',
                },
            };
        } catch (error) {
            return {
                params: {
                    error: error.message,
                },
            };
        }
    }

    @SubscribeMessage('consumer-resume')
    async consumerResume(@ConnectedSocket() client: Socket) {
        const { id: socketId } = client;

        this.logger.debug('consumer-resume');

        const consumer = Room.getConsumer(socketId);

        await consumer.resume();
    }

    get webRtcTransportOptions() {
        return {
            listenIps: [
                {
                    ip: '0.0.0.0',
                    announcedIp: process.env.IP || ip.address(),
                },
            ],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
            maxIncomingBitrate: 1500000,
            initialAvailableOutgoingBitrate: 1000000,
        };
    }

    private async _createWebRtcTransport(router) {
        this.logger.debug('webRtcTransportOptions:');
        this.logger.debug(this.webRtcTransportOptions);

        const transport = await router.createWebRtcTransport(this.webRtcTransportOptions);

        this.logger.debug(`transport id: ${transport.id} is opened`);

        transport.observer.on('dtlsstatechange', (dtlsState) => {
            if (dtlsState === 'closed') {
                transport.close();
            }
        });

        transport.observer.on('close', () => {
            this.logger.debug(`transport id: ${transport.id} is closed`);
        });

        return {
            transport,
            params: {
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            },
        };
    }

    afterInit() {
        this.logger.log('Call after init Server callback');
    }

    async handleDisconnect(client: Socket) {
        await Room.removeClient(client.data.roomId, client.data.socketId);

        this.logger.log(`Client disconnected: ${client.id}`);

        client.leave(client.data.roomId);
    }

    handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);
    }
}
