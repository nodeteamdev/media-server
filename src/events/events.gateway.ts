import {
    MessageBody,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
    OnGatewayInit,
    WsResponse,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { from, Observable } from 'rxjs';
import * as ip from 'ip';
import { map } from 'rxjs/operators';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// eslint-disable-next-line
import * as mediasoup from 'mediasoup';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
    namespace: 'mediasoupe',
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
        server: Server;

    private logger: Logger = new Logger('AppGateway');

    public worker: any;

    public router: any;

    public producerTransport: any;

    public consumerTransport: any;

    public producer: any;

    public consumer: any;

    constructor(private configService: ConfigService) {
        this.createWorkers();
    }

    /**
     * Worker
     * |-> Router(s)
     *     |-> Producer Transport(s)
     *         |-> Producer
     *     |-> Consumer Transport(s)
     *         |-> Consumer
     * */
    async createWorkers() {
        const mediasoupSettings = this.configService.get('mediasoup');

        this.logger.debug('Create Mediasoup worker with next config');
        this.logger.debug(mediasoupSettings);

        this.worker = await mediasoup.createWorker(mediasoupSettings.worker);
        this.router = await this.worker.createRouter({
            mediaCodecs: mediasoupSettings.router.mediaCodecs,
        });

        this.logger.debug(`Worker PID ${this.worker.pid} started`);
        this.logger.debug(`Router rtpCapabilities ${JSON.stringify(this.router.rtpCapabilities, null, 2)}`);

        this.worker.on('died', (error) => {
            this.logger.error('Mediasoup worker has died.');
            this.logger.error(error);
            setTimeout(() => process.exit(1), 2000);
        });

        this.getLogResourceUsage(this.worker);
    }

    private getLogResourceUsage(worker) {
        const mediasoupSettings = this.configService.get('mediasoup');

        setInterval(() => {
            worker.getResourceUsage().then((data) => {
                if (mediasoupSettings.resourceLogLevel === 'short') {
                    this.logger.debug(data);
                } else {
                    this.logger.debug(`integral unshared data size 'ru_idrss':${data.ru_idrss}`);
                    this.logger.debug(`block input operations 'ru_inblock':${data.ru_inblock}`);
                    this.logger.debug(`integral unshared stack size 'ru_isrss':${data.ru_isrss}`);
                    this.logger.debug(`integral shared memory size 'ru_ixrss': ${data.ru_ixrss}`);
                    this.logger.debug(`page faults (hard page faults) 'ru_majflt': ${data.ru_majflt}`);
                    this.logger.debug(`maximum resident set size 'ru_maxrss':${data.ru_maxrss}`);
                    this.logger.debug(`page reclaims (soft page faults) 'ru_minflt':${data.ru_minflt}`);
                    this.logger.debug(`IPC messages received 'ru_msgrcv': ${data.ru_msgrcv}`);
                    this.logger.debug(`IPC messages sent 'ru_msgsnd':${data.ru_msgsnd}`);
                    this.logger.debug(`involuntary context switches 'ru_nivcsw':${data.ru_nivcsw}`);
                    this.logger.debug(`signals received 'ru_nsignals':${data.ru_nsignals}`);
                    this.logger.debug(`swaps 'ru_nswap':${data.ru_nswap}`);
                    this.logger.debug(` voluntary context switches 'ru_nvcsw':${data.ru_nvcsw}`);
                    this.logger.debug(`block output operations 'ru_oublock':${data.ru_oublock}`);
                    this.logger.debug(`system CPU time used 'ru_stime':${data.ru_stime}`);
                    this.logger.debug(`user CPU time used 'ru_utime':${data.ru_utime}`);
                }
            });
        }, mediasoupSettings.resourceInterval);
    }

    @SubscribeMessage('events')
    findAll(@MessageBody() data: any): Observable<WsResponse<number>> {
        return from([1, 2, 3]).pipe(map(() => ({ event: 'events', data: { ...data } })));
    }

    @SubscribeMessage('getRtpCapabilities')
    getRtpCapabilities() {
        return {
            rtpCapabilities: this.router.rtpCapabilities,
        };
    }

    @SubscribeMessage('createWebRtcTransport')
    async createTransport(@MessageBody() data: { sender: boolean; }) {
        if (data.sender) {
            const { transport, params } = await this.createWebRtcTransport();

            this.producerTransport = transport;

            return { params };
        }

        const { transport, params } = await this.createWebRtcTransport();

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
        this.logger.debug(`transport recv connect: ${dtlsParameters} sent`);

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
    async consume(@MessageBody() { rtpCapabilities }) {
        try {
            if (this.router.canConsume({
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

    private async createWebRtcTransport() {
        this.logger.debug('webRtcTransportOptions:');
        this.logger.debug(this.webRtcTransportOptions);

        const transport = await this.router.createWebRtcTransport(this.webRtcTransportOptions);

        this.logger.debug(`transport id: ${transport.id} is opened`);

        transport.on('dtlsstatechange', (dtlsState) => {
            if (dtlsState === 'closed') {
                transport.close();
            }
        });

        transport.on('close', () => {
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

    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }

    handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);
        this.server.emit('connection-success', {
            socketId: client.id,
        });
    }
}
