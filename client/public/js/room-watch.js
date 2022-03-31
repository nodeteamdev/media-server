const app = {
    socketId: null,
    rtpCapabilities: null,
    device: null,
    isProducer: null,
    producer: null,
    consumer: null,
    producerTransport: null,
    consumerTransport: null,
    producerOptions: {
        codecOptions: {
            videoGoogleStartBitrate: 1000,
        },
    },
};

const KIND_TYPE = {
    AUDIO: 'audio',
    VIDEO: 'video',
};
const setConsumeVideo = (track) => {
    const video = document.getElementById('remoteVideo');

    video.srcObject = new MediaStream([track]);
    video.controls = '1';

    video.play();
};

const setConsumeAudio = (track) => {
    const video = document.getElementById('remoteVideo');

    video.srcObject.addTrack(track);
};

const getRtpCapabilities = (callback) => {
    socket.emit('getRtpCapabilities', (data) => {
        app.rtpCapabilities = data.rtpCapabilities;

        console.log('app.rtpCapabilities', app.rtpCapabilities);

        if (typeof callback === 'function') {
            callback();
        }
    });
};

const createDevice = async (callback) => {
    app.device = new mediasoupClient.Device();

    await app.device.load({
        routerRtpCapabilities: app.rtpCapabilities,
    });

    console.log(' app.device', app.device);

    if (typeof callback === 'function') {
        callback();
    }
};

const createRecvTransport = (callback) => {
    socket.emit('createWebRtcTransport', { sender: false }, ({ params }) => {
        if (params.error) {
            console.error('Cannot createWebRtcTransport consume', params.error);
            return;
        }

        console.log('createRecvTransport params', params);

        app.consumerTransport = app.device.createRecvTransport(params);
        app.consumerTransport.on('connect', async ({ dtlsParameters }, _callback, _errback) => {
            try {
                await socket.emit('transport-recv-connect', {
                    dtlsParameters,
                });

                _callback();
            } catch (error) {
                _errback(error);
            }
        });

        if (typeof callback === 'function') callback();
    });
};

const connectRecvTransport = (kind) => {
    socket.emit('consume', {
        rtpCapabilities: app.device.rtpCapabilities,
        kind,
    }, async ({ params }) => {
        if (params.error) {
            console.error(params.error);
            return;
        }

        console.log('Consume params', params);

        app.consumer = await app.consumerTransport.consume({
            id: params.id,
            producerId: params.producerId,
            kind: params.kind,
            rtpParameters: params.rtpParameters,
        });

        const { track } = app.consumer;

        if (KIND_TYPE.VIDEO === kind) {
            setConsumeVideo(track);
        }

        if (KIND_TYPE.AUDIO === kind) {
            setConsumeAudio(track);
        }

        socket.emit('consumer-resume', {
            kind: params.kind,
        });
    });
};

const goCreateTransport = () => createRecvTransport(() => {
    connectRecvTransport('video');
    connectRecvTransport('audio');
});

const goConnect = ({ produce }) => {
    app.isProducer = produce;

    if (!app.device) {
        return getRtpCapabilities(() => createDevice(() => {
            goCreateTransport();
        }));
    }

    return goCreateTransport();
};

const startConsume = () => {
    goConnect({
        produce: false,
    });
};

socket.on('connect', () => {
    app.socketId = socket.id;
    app.roomId = window.location.pathname.split('/').pop();

    socket.emit('join', {
        roomId: app.roomId,
    }, () => {
        console.log('join success');
    });

    console.log('socket.id', socket.id);
});

document.getElementById('btnStartConsume').addEventListener('mouseup', startConsume);
