import { Room } from './room';
import { FFmpeg } from './ffmpeg';
import Transport from './transport';
import { Address } from './address';

export class Recording {
    recordName: string;

    recordInfo: { audio: any, video: any };

    process: FFmpeg;

    remotePorts: number[] = [];

    constructor() {
        this.recordName = Recording.generateRandomFileName();
        this.recordInfo = {
            audio: null,
            video: null,
        };
    }

    getProcess() {
        return new FFmpeg(this.recordInfo, this.recordName);
    }

    private static generateRandomFileName() {
        return `recording-${Math.floor(Math.random() * 100000)}`;
    }

    /**
     * @TODO: Implement stop recording
     */
    async stopRecording() {}

    async startRecord(roomId) {
        const videoProducer = Room.getVideoProducer(roomId);
        const audioProducer = Room.getAudioProducer(roomId);

        this.recordInfo.video = await this.publishProducerRtpStream(roomId, videoProducer.producer);
        this.recordInfo.audio = await this.publishProducerRtpStream(roomId, audioProducer.producer);

        setTimeout(async () => {
            await this.recordInfo.video.rtpConsumer.resume();
            await this.recordInfo.video.rtpConsumer.requestKeyFrame();

            await this.recordInfo.audio.rtpConsumer.resume();
            await this.recordInfo.audio.rtpConsumer.requestKeyFrame();
        }, 1000);

        this.process = this.getProcess();
    }

    getRandomPort() {
        const minPort = 10000;
        const maxPort = 10100;

        return Math.floor(Math.random() * (maxPort - minPort)) + minPort;
    }

    async publishProducerRtpStream(roomId, producer) {
        const codecs = [];
        const router = Room.getRouter(roomId);

        const rtpTransport = await Transport.createPlainRtpTransport(router);

        const remoteRtpPort = this.getRandomPort();
        const remoteRtcpPort = this.getRandomPort();

        this.remotePorts.push(remoteRtpPort);

        await rtpTransport.connect({
            ip: Address.getIPv4(),
            port: remoteRtpPort,
            rtcpPort: remoteRtcpPort,
        });

        codecs.push(
            router.rtpCapabilities.codecs.find(
                (codec) => codec.kind === producer.kind,
            ),
        );

        const rtpCapabilities = {
            codecs,
            rtcpFeedback: [],
        };

        const rtpConsumer = await rtpTransport.consume({
            producerId: producer.id,
            rtpCapabilities,
            paused: true,
        });

        return {
            rtpConsumer,
            remoteRtpPort,
            remoteRtcpPort,
            localRtcpPort: rtpTransport.rtcpTuple ? rtpTransport.rtcpTuple.localPort : undefined,
            rtpCapabilities,
            rtpParameters: rtpConsumer.rtpParameters,
        };
    }
}
