/* eslint-disable no-console */
const mediasoupClient = require('mediasoup-client');
const io = require('socket.io-client');

const socket = io('/mediasoupe');

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

const setProduceVideo = (stream, callback) => {
    document.getElementById('localVideo').srcObject = stream;

    const track = stream.getVideoTracks()[0];

    app.producerOptions = {
        track,
        ...app.producerOptions,
    };

    if (typeof callback === 'function') {
        callback();
    }
};

const setConsumeVideo = (track) => {
    document.getElementById('remoteVideo').srcObject = new MediaStream([track]);
};

const getLocalStream = (callback) => {
    window.navigator.getUserMedia({
        audio: false,
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
    app.producer = await app.producerTransport.produce(app.producerOptions);

    app.producer.on('trackended', () => {
        console.log('track ended');
    });

    app.producer.on('transportclose', () => {
        console.log('transport ended');
    });
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

        if (typeof callback === 'function') {
            callback();
        }
    });
};

const connectRecvTransport = () => {
    socket.emit('consume', {
        rtpCapabilities: app.device.rtpCapabilities,
    }, async ({ params }) => {
        if (params.error) {
            console.error('Cannot Consume', params.error);
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

        setConsumeVideo(track);

        socket.emit('consumer-resume');
    });
};

const goCreateTransport = () => {
    if (app.isProducer) {
        return createSendTransport(() => connectSendTransport());
    }

    return createRecvTransport(() => {
        connectRecvTransport();
    });
};

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

socket.on('connection-success', ({ socketId }) => {
    app.socketId = socketId;

    console.log('app.socketId', app.socketId);

    startProduce();
});
