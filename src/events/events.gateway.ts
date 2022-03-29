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

    public producerTransport: types.WebRtcTransport;

    public consumerTransport: types.WebRtcTransport;

    public producer: types.Producer;

    public consumer: types.Consumer;

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
            room.router = await Room.createRouter(this.worker, mediasoupSettings.router.mediaCodecs);
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
        const { roomId } = client.data;
        const { router } = await Room.getRoom(roomId);

        if (data.sender) {
            const { transport, params } = await this._createWebRtcTransport(router);

            this.producerTransport = transport;

            return { params };
        }

        const { transport, params } = await this._createWebRtcTransport(router);

        this.consumerTransport = transport;

        return { params };
    }

    @SubscribeMessage('transport-connect')
    async transportConnect(@MessageBody() { dtlsParameters }) {
        this.logger.debug('transport connect dtlsParameters sent');

        await this.producerTransport.connect({ dtlsParameters });
    }

    @SubscribeMessage('transport-recv-connect')
    async transportRecvConnect(@MessageBody() { dtlsParameters }) {
        this.logger.debug('transport recv connect:');
        this.logger.debug(dtlsParameters);

        await this.consumerTransport.connect({ dtlsParameters });
    }

    @SubscribeMessage('transport-produce')
    async transportProduce(@MessageBody() { kind, rtpParameters }) {
        this.producer = await this.producerTransport.produce({
            kind,
            rtpParameters,
        });

        this.logger.debug(`producer id: ${this.producer.id}, producer kind: ${this.producer.kind}`);

        this.producer.on('transportclose', () => {
            this.logger.debug(`transport for this producer ${this.producer.id} closed`);

            this.producer.close();
        });

        return {
            id: this.producer.id,
        };
    }

    @SubscribeMessage('consume')
    async consume(@MessageBody() { rtpCapabilities }, @ConnectedSocket() client: Socket) {
        const { roomId } = client.data;
        const { router } = await Room.getRoom(roomId);

        try {
            if (router.canConsume({
                producerId: this.producer.id,
                rtpCapabilities,
            })) {
                this.consumer = await this.consumerTransport.consume({
                    producerId: this.producer.id,
                    rtpCapabilities,
                    paused: true,
                });

                this.consumer.on('transportclose', () => {
                    this.logger.debug('transport close from consumer');
                });

                this.consumer.on('producerclose', () => {
                    this.logger.debug('producer of consumer closed');
                });

                return {
                    params: {
                        id: this.consumer.id,
                        producerId: this.consumer.id,
                        kind: this.consumer.kind,
                        rtpParameters: this.consumer.rtpParameters,
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
    async consumerResume() {
        this.logger.debug('consumer-resume');

        await this.consumer.resume();
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
