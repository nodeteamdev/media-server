import * as ip from 'ip';

export class SDP {
    static getCodecInfoFromRtpParameters(kind, rtpParameters) {
        return {
            payloadType: rtpParameters.codecs[0].payloadType,
            codecName: rtpParameters.codecs[0].mimeType.replace(`${kind}/`, ''),
            clockRate: rtpParameters.codecs[0].clockRate,
            channels: kind === 'audio' ? rtpParameters.codecs[0].channels : undefined,
        };
    }

    static createSdpText(rtpParameters) {
        const { video, audio } = rtpParameters;

        const videoCodecInfo = SDP.getCodecInfoFromRtpParameters('video', video.rtpParameters);
        const audioCodecInfo = SDP.getCodecInfoFromRtpParameters('audio', audio.rtpParameters);

        return `v=0
          o=- 0 0 IN IP4 127.0.0.1
          s=FFmpeg
          c=IN IP4 127.0.0.1
          t=0 0
          m=video ${video.remoteRtpPort} RTP/AVP ${videoCodecInfo.payloadType} 
          a=rtpmap:${videoCodecInfo.payloadType} ${videoCodecInfo.codecName}/${videoCodecInfo.clockRate}
          a=sendonly
          m=audio ${audio.remoteRtpPort} RTP/AVP ${audioCodecInfo.payloadType} 
          a=rtpmap:${audioCodecInfo.payloadType} ${audioCodecInfo.codecName}/${audioCodecInfo.clockRate}/${audioCodecInfo.channels}
          a=sendonly
  `;
    }
}
