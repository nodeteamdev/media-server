import * as ip from 'ip';
import { Room } from './room';
import { FFmpeg } from './ffmpeg';
import Transport from './transport';

export class Recording {
    recordName: string;

    recordInfo: any;

    process: any;

    remotePorts: number[] = [];

    constructor() {
        this.recordName = this.generateRandomFileName();
        this.recordInfo = {
            recordName: this.recordName,
        };
    }

    private generateRandomFileName() {
        return `recording-${Math.floor(Math.random() * 100000)}`;
    }

    async startRecord(roomId) {
        const videoProducer = Room.getVideoProducer(roomId);
        const audioProducer = Room.getAudioProducer(roomId);

        this.recordInfo.video = await this.publishProducerRtpStream(roomId, videoProducer.producer);
        this.recordInfo.audio = await this.publishProducerRtpStream(roomId, audioProducer.producer);

        this.process = this.getProcess();
    }

    getProcess() {
        const ffmpeg = new FFmpeg(this.recordInfo);

        return ffmpeg;
    }

    getRandomPort() {
        const minPort = 10000;
        const maxPort = 10100;

        return Math.floor(Math.random() * (maxPort - minPort)) + minPort;
    }

    async publishProducerRtpStream(roomId, producer) {
        const router = Room.getRouter(roomId);

        const rtpTransport = await Transport.createPlainRtpTransport(router);

        const remoteRtpPort = this.getRandomPort();
        const remoteRtcpPort = this.getRandomPort();

        this.remotePorts.push(remoteRtpPort);

        await rtpTransport.connect({
            ip: '127.0.0.1',
            port: remoteRtpPort,
            rtcpPort: remoteRtcpPort,
        });

        const codecs = [];
        const routerCodec = router.rtpCapabilities.codecs.find(
            (codec) => codec.kind === producer.kind,
        );
        codecs.push(routerCodec);

        const rtpCapabilities = {
            codecs,
            rtcpFeedback: [],
        };

        const rtpConsumer = await rtpTransport.consume({
            producerId: producer.id,
            rtpCapabilities,
            paused: true,
        });

        setTimeout(async () => {
            await rtpConsumer.resume();
            await rtpConsumer.requestKeyFrame();
        }, 1000);

        return {
            remoteRtpPort,
            remoteRtcpPort,
            localRtcpPort: rtpTransport.rtcpTuple ? rtpTransport.rtcpTuple.localPort : undefined,
            rtpCapabilities,
            rtpParameters: rtpConsumer.rtpParameters,
        };
    }
}
