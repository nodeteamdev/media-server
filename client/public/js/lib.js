const mediasoupClient = require('mediasoup-client');
const io = require('socket.io-client');

const socket = io('/mediasoup', { transports: ['websocket'] });

window.mediasoupClient = mediasoupClient;
window.socket = socket;
window.io = io;
