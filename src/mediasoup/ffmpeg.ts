import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { Logger } from '@nestjs/common';

import { Readable } from 'stream';
import { SDP } from './sdp';

const RECORD_FILE_LOCATION_PATH = './files';

export class FFmpeg {
    private logger = new Logger(FFmpeg.name);

    rtpParameters: any;

    process: any = null;

    observer: EventEmitter;

    constructor(rtpParameters) {
        this.rtpParameters = rtpParameters;
        this.observer = new EventEmitter();
        this._createProcess();
    }

    convertStringToStream(stringToConvert: string) {
        const stream = new Readable();
        stream._read = () => {};
        stream.push(stringToConvert);
        stream.push(null);

        return stream;
    }

    _createProcess() {
        const sdpString = SDP.createSdpText(this.rtpParameters);
        const sdpStream = this.convertStringToStream(sdpString);

        this.logger.debug('createProcess() [sdpString:%s]', sdpString);

        this.process = spawn('ffmpeg', this._commandArgs);

        if (this.process.stderr) {
            this.process.stderr.setEncoding('utf-8');

            this.process.stderr.on('data', (data) => this.logger.debug('ffmpeg::process::data', data));
        }

        if (this.process.stdout) {
            this.process.stdout.setEncoding('utf-8');

            this.process.stdout.on('data', (data) => this.logger.debug('ffmpeg::process::data', data));
        }

        this.process.on('message', (message) => this.logger.debug('ffmpeg::process::message', message));

        this.process.on('error', (error) => this.logger.error('ffmpeg::process::error', error));

        this.process.once('close', () => {
            this.logger.debug('ffmpeg::process::close');
            this.observer.emit('process-close');
        });

        sdpStream.on('error', (error) => this.logger.error('sdpStream::error [error:]', error));

        // Pipe sdp stream to the ffmpeg process
        sdpStream.resume();
        sdpStream.pipe(this.process.stdin);
    }

    kill() {
        this.logger.debug('kill() [pid:%d]', this.process.pid);
        this.process.kill('SIGINT');
    }

    get _commandArgs() {
        let commandArgs = [
            '-loglevel',
            'debug',
            '-protocol_whitelist',
            'pipe,udp,rtp',
            '-fflags',
            '+genpts',
            '-f',
            'sdp',
            '-i',
            'pipe:0',
        ];

        commandArgs = commandArgs.concat(this._videoArgs);
        commandArgs = commandArgs.concat(this._audioArgs);

        commandArgs = commandArgs.concat([
            `${RECORD_FILE_LOCATION_PATH}/${this.rtpParameters.recordName}.webm`,
        ]);

        this.logger.debug('commandArgs:%o', commandArgs);

        return commandArgs;
    }

    get _videoArgs() {
        return [
            '-map',
            '0:v:0',
            '-c:v',
            'copy',
        ];
    }

    get _audioArgs() {
        return [
            '-map',
            '0:a:0',
            '-strict',
            '-2',
            '-c:a',
            'copy',
        ];
    }
}
