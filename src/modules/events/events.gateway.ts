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
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { types } from 'mediasoup';
import { Worker } from '../mediasoup/worker';
import { Room } from '../mediasoup/room';
import { KIND_TYPE } from '../../enums/kind';
import Transport from '../mediasoup/transport';
import { Recording } from '../mediasoup/recording';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
    namespace: 'mediasoup',
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
        server: Server;

    private logger: Logger = new Logger(EventsGateway.name);

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

        this.server.to(roomId).emit('count-update', {
            count: Room.getClientsCount(roomId),
        });

        return {
            socketId,
            roomId,
            count: room.clients.length - 1,
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
            const { transport, params } = await Transport.createWebRtcTransport(router);

            Room.setProducerTransport(socketId, transport);

            return { params };
        }

        const { transport, params } = await Transport.createWebRtcTransport(router);

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

        if (kind === KIND_TYPE.VIDEO) {
            const producerTransport = Room.getProducerTransport(socketId);

            const producer = await producerTransport.produce({
                kind,
                rtpParameters,
            });

            Room.setVideoProducer(roomId, socketId, producer);

            this.logger.debug(`producer id: ${producer.id}, producer kind: ${producer.kind}`);

            producer.on('transportclose', () => {
                this.logger.debug(`transport for this producer ${producer.id} closed`);

                producer.close();
            });

            return {
                id: producer.id,
            };
        }

        if (kind === KIND_TYPE.AUDIO) {
            const producerTransport = Room.getProducerTransport(socketId);

            const producer = await producerTransport.produce({
                kind,
                rtpParameters,
            });

            Room.setAudioProducer(roomId, socketId, producer);

            this.logger.debug(`producer id: ${producer.id}, producer kind: ${producer.kind}`);

            producer.on('transportclose', () => {
                this.logger.debug(`transport for this producer ${producer.id} closed`);

                producer.close();
            });

            return {
                id: producer.id,
            };
        }

        return {
            error: 'kind is not supported, must be "audio" or "video"',
        };
    }

    @SubscribeMessage('consume')
    async consume(@MessageBody() { rtpCapabilities, kind }, @ConnectedSocket() client: Socket) {
        const { roomId } = client.data;
        const { router } = await Room.getRoom(roomId);
        const { id: socketId } = client;

        const consumerTransport = Room.getConsumerTransport(socketId);
        const { producer } = KIND_TYPE.VIDEO === kind
            ? Room.getVideoProducer(roomId)
            : Room.getAudioProducer(roomId);

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

                if (KIND_TYPE.VIDEO === kind) {
                    Room.setVideoConsumer(socketId, consumer);
                } else {
                    Room.setAudioConsumer(socketId, consumer);
                }

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
                    error: 'Transport can not consume. Please check rtpCapabilities.',
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
    async consumerResume(@ConnectedSocket() client: Socket, @MessageBody() { kind }) {
        const { id: socketId } = client;

        this.logger.debug('consumer-resume');

        if (kind === KIND_TYPE.VIDEO) {
            const consumer = Room.getVideoConsumer(socketId);

            consumer.resume();
        }

        if (kind === KIND_TYPE.AUDIO) {
            const consumer = Room.getAudioConsumer(socketId);

            consumer.resume();
        }

        return {
            error: 'kind is not supported, must be "audio" or "video"',
        };
    }

    @SubscribeMessage('recording-start')
    async recordingStart(@ConnectedSocket() client: Socket) {
        const { id: socketId } = client;
        const { roomId } = client.data;

        const recording = new Recording();

        await recording.startRecord(roomId);

        this.logger.debug('recording-start', socketId, roomId);
    }

    afterInit() {
        this.logger.log('Call after init Server callback');
    }

    async handleDisconnect(client: Socket) {
        await Room.removeClient(client.data.roomId, client.data.socketId);

        const { roomId } = client.data;
        const { id: socketId } = client;

        Room.closeProducerTransport(socketId);
        Room.closeConsumerTransport(socketId);
        Room.closeVideoProducer(roomId, socketId);
        Room.closeAudioProducer(roomId, socketId);
        Room.closeAudioConsumer(socketId);
        Room.closeVideoConsumer(socketId);

        this.logger.log(`Client disconnected: ${client.id}`);

        this.server.to(roomId).emit('count-update', {
            count: Room.getClientsCount(roomId),
        });

        client.leave(client.data.roomId);
    }

    handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);
    }
}
