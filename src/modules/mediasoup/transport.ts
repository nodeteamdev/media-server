import { Logger } from '@nestjs/common';
import { Address } from './address';

class Transport {
    private logger = new Logger(Transport.name);

    /**
     * @returns {
     *     listenIp: {
     *         ip: string,
     *         announcedIp: string,
     *     },
     *     rtcpMux: boolean,
     *     comedia: boolean,
     * }
     */
    get plainRtpTransport() {
        return {
            listenIp: {
                ip: '0.0.0.0',
                announcedIp: Address.getIPv4(),
            },
            rtcpMux: false,
            comedia: false,
        };
    }

    get webRtcTransportOptions() {
        return {
            listenIps: [
                {
                    ip: '0.0.0.0',
                    announcedIp: Address.getIPv4(),
                },
            ],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
            maxIncomingBitrate: 1500000,
            initialAvailableOutgoingBitrate: 1000000,
        };
    }

    public createPlainRtpTransport(router) {
        this.logger.debug('plainRtpTransport:');
        this.logger.debug(this.plainRtpTransport);

        return router.createPlainRtpTransport(this.plainRtpTransport);
    }

    public async createWebRtcTransport(router) {
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
}

const transport = new Transport();

export default transport;
