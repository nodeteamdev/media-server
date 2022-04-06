import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { Logger } from '@nestjs/common';

import { Readable } from 'stream';
import { join } from 'path';
import { types } from 'mediasoup';
import { SDP } from './sdp';

/**
 * @class FFmpeg
 * @classdesc FFmpeg wrapper.
 * @extends EventEmitter
 */
export class FFmpeg {
    private logger = new Logger(FFmpeg.name);

    rtpParameters: types.RtpParameters;

    process: ChildProcess;

    observer: EventEmitter;

    recordName: string;

    /**
     * @constructor
     * @param {string} recordName name for new video file to be created
     * @param {types.RtpParameters} rtpParameters RTP parameters
     */
    constructor(rtpParameters, recordName: string) {
        this.rtpParameters = rtpParameters;
        this.observer = new EventEmitter();
        this.recordName = recordName;

        this._createProcess();
    }

    /**
     * @private
     * @method convertStringToStream
     * @description convert SDP string to stream
     */
    private convertStringToStream(stringToConvert: string) {
        const stream = new Readable();
        stream._read = () => {};
        stream.push(stringToConvert);
        stream.push(null);

        return stream;
    }

    /**
     * @private
     * @method _createProcess
     * @description Creates FFmpeg process.
     */
    _createProcess() {
        const sdpString = SDP.createSdpText(this.rtpParameters);
        const sdpStream = this.convertStringToStream(sdpString);

        this.logger.debug('createProcess() [sdpString:%s]', sdpString);

        this.process = spawn('ffmpeg', this._commandArgs);

        if (this.process.stderr) {
            this.process.stderr.setEncoding('utf-8');

            this.process.stderr.on('data', (data) => {
                this.logger.debug('ffmpeg::process::data', data);
            });
        }

        if (this.process.stdout) {
            this.process.stdout.setEncoding('utf-8');

            this.process.stdout.on('data', (data) => {
                this.logger.debug('ffmpeg::process::data', data);
            });
        }

        this.process.on('message', (message) => {
            this.logger.debug('ffmpeg::process::message', message);
        });

        this.process.on('error', (error) => {
            this.logger.error('ffmpeg::process::error', error);
        });

        this.process.once('close', () => {
            this.logger.debug('ffmpeg::process::close');
            this.observer.emit('process-close');
        });

        sdpStream.on('error', (error) => {
            this.logger.error('sdpStream::error [error:]', error);
        });

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
            '-flags',
            '+global_header',
        ];

        commandArgs = commandArgs.concat(this._videoArgs);
        commandArgs = commandArgs.concat(this._audioArgs);

        commandArgs = commandArgs.concat([
            join(__dirname, '..', '..', '..', 'files', `${this.recordName}.webm`),
        ]);

        this.logger.debug('commandArgs', commandArgs);

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
            '-c:a',
            'copy',
        ];
    }
}
