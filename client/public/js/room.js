const app = {
    socketId: null,
    rtpCapabilities: null,
    device: null,
    roomId: null,
    isProducer: null,
    producer: null,
    audioConsumer: null,
    videoConsumer: null,
    producerTransport: null,
    consumerTransport: null,
    producerOptions: {
        codecOptions: {
            videoGoogleStartBitrate: 1000,
        },
    },
};

const setProduceVideo = (stream, callback) => {
    const localVideo = document.getElementById('localVideo');
    localVideo.srcObject = stream;
    localVideo.volume = 0;

    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];

    app.videoProducerOptions = {
        track: videoTrack,
        ...app.producerOptions,
    };

    app.audioProducerOptions = {
        track: audioTrack,
        ...app.producerOptions,
    };

    if (typeof callback === 'function') {
        callback();
    }
};

const getLocalStream = (callback) => {
    window.navigator.getUserMedia({
        audio: true,
        video: {
            width: {
                min: 640,
                max: 1920,
            },
            height: {
                min: 400,
                max: 1080,
            },
        },
    }, (stream) => {
        if (typeof callback === 'function') {
            return callback(stream);
        }
        return setProduceVideo(stream);
    }, (error) => {
        console.error(error.message);
    });
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

const createSendTransport = (callback) => {
    socket.emit('createWebRtcTransport', { sender: true }, ({ params }) => {
        app.producerTransport = app.device.createSendTransport(params);

        console.log('app.producerTransport', app.producerTransport);

        app.producerTransport.on('connect', async ({ dtlsParameters }, _callback, _errback) => {
            try {
                await socket.emit('transport-connect', {
                    dtlsParameters,
                });

                _callback();
            } catch (error) {
                _errback(error);
            }
        });

        app.producerTransport.on('produce', async (parameters, _callback, _errback) => {
            console.log('on produce parameters', parameters);

            try {
                await socket.emit('transport-produce', {
                    kind: parameters.kind,
                    rtpParameters: parameters.rtpParameters,
                    appData: parameters.appData,
                }, ({ id }) => {
                    _callback({ id });
                });
            } catch (error) {
                _errback(error);
            }
        });

        if (typeof callback === 'function') {
            callback();
        }
    });
};

const connectSendTransport = async () => {
    app.videoProducer = await app.producerTransport.produce(app.videoProducerOptions);

    app.videoProducer.on('trackended', () => {
        console.log('video track ended');
    });

    app.videoProducer.on('transportclose', () => {
        console.log('video transport ended');
    });

    app.audioProducer = await app.producerTransport.produce(app.audioProducerOptions);

    app.audioProducer.on('trackended', () => {
        console.log('audio track ended');
    });

    app.audioProducer.on('transportclose', () => {
        console.log('audio transport ended');
    });
};

const goCreateTransport = () => createSendTransport(() => connectSendTransport());

const goConnect = ({ produce }) => {
    app.isProducer = produce;

    if (!app.device) {
        return getRtpCapabilities(() => createDevice(() => {
            goCreateTransport();
        }));
    }

    return goCreateTransport();
};

const startProduce = () => {
    getLocalStream((stream) => {
        setProduceVideo(stream, () => {
            goConnect({
                produce: true,
            });
        });
    });
};

socket.on('connect', () => {
    app.socketId = socket.id;
    app.roomId = window.location.pathname.split('/').pop();

    socket.emit('join', {
        roomId: app.roomId,
    }, () => {
        startProduce();
    });

    console.log('socket connected', socket.id);
});
