import { types } from 'mediasoup';

const rooms = new Map();
const audioProducers = new Map();
const videoProducers = new Map();
const audioConsumers = new Map();
const videoConsumers = new Map();
const producerTransports = new Map();
const consumerTransports = new Map();

export class Room {
    /**
     * @type {string[]} list of socket session ids
     */
    clients: string[] = [];

    /**
     * A router enables injection, selection and forwarding
     * of media streams through Transport instances created on it.
     *
     * @type {null| types.Router}
     */
    router: null | types.Router = null;

    constructor(roomId: string) {
        this.clients = [];

        rooms.set(roomId, this);
    }

    get rooms() {
        return rooms;
    }

    static getRouter(roomId) {
        if (rooms.has(roomId)) {
            const room = rooms.get(roomId);

            return room.router;
        }
        return null;
    }

    static closeProducerTransport(socketId: string) {
        const transport = producerTransports.get(socketId);

        if (transport) {
            transport.close();
            producerTransports.delete(socketId);
        }
    }

    static closeConsumerTransport(socketId: string) {
        const transport = consumerTransports.get(socketId);

        if (transport) {
            transport.close();
            consumerTransports.delete(socketId);
        }
    }

    static closeVideoProducer(roomId: string, socketId: string) {
        const producer = videoProducers.get(roomId);

        if (producer && producer.producer && producer.socketId === socketId) {
            producer.producer.close();
            videoProducers.delete(roomId);
        }
    }

    static closeAudioProducer(roomId: string, socketId: string) {
        const producer = audioProducers.get(roomId);

        if (producer && producer.producer && producer.socketId === socketId) {
            producer.producer.close();
            audioProducers.delete(roomId);
        }
    }

    static closeVideoConsumer(socketId: string) {
        const consumer = videoConsumers.get(socketId);

        if (consumer) {
            consumer.close();
            videoConsumers.delete(socketId);
        }
    }

    static closeAudioConsumer(socketId: string) {
        const consumer = audioConsumers.get(socketId);

        if (consumer) {
            consumer.close();
            audioConsumers.delete(socketId);
        }
    }

    static setProducerTransport(socketId: string, transport: types.Transport) {
        return producerTransports.set(socketId, transport);
    }

    static getProducerTransport(socketId: string) {
        return producerTransports.get(socketId);
    }

    static setConsumerTransport(roomId: string, transport: types.Transport) {
        return consumerTransports.set(roomId, transport);
    }

    static getConsumerTransport(socketId: string) {
        return consumerTransports.get(socketId);
    }

    static setAudioProducer(roomId: string, socketId: string, producer: types.Producer) {
        return audioProducers.set(roomId, {
            socketId,
            producer,
        });
    }

    static setVideoProducer(roomId: string, socketId: string, producer: types.Producer) {
        return videoProducers.set(roomId, {
            socketId,
            producer,
        });
    }

    static getAudioProducer(roomId: string) {
        return audioProducers.get(roomId);
    }

    static getVideoProducer(roomId: string) {
        return videoProducers.get(roomId);
    }

    static setVideoConsumer(socketId: string, consumer: types.Consumer) {
        return videoConsumers.set(socketId, consumer);
    }

    static setAudioConsumer(socketId: string, consumer: types.Consumer) {
        return audioConsumers.set(socketId, consumer);
    }

    static getVideoConsumer(socketId: string) {
        return videoConsumers.get(socketId);
    }

    static getAudioConsumer(socketId: string) {
        return audioConsumers.get(socketId);
    }

    static async createRouter(
        worker: types.Worker,
        mediaCodecs: types.RtpCodecCapability[],
    ): Promise<types.Router> {
        return worker.createRouter({
            mediaCodecs,
        });
    }

    static async removeClient(roomId: string, clientId: string) {
        const room = rooms.get(roomId);

        if (room) {
            const index = room.clients.indexOf(clientId);

            if (index !== -1) {
                room.clients.splice(index, 1);
            }
        }
    }

    static getClientsCount(roomId: string) {
        const room = rooms.get(roomId);

        if (room) {
            return room.clients.length - 1;
        }

        return 0;
    }

    static async joinClient(roomId: string, clientId: string) {
        const existRoom: Room = await Room.getRoom(roomId);

        if (!existRoom) {
            const room: Room = new Room(roomId);

            await room.addClient(roomId, clientId);

            return room;
        }

        await existRoom.addClient(roomId, clientId);

        return existRoom;
    }

    static getRoom(roomId: string): Promise<Room> {
        return new Promise((resolve) => {
            if (rooms.has(roomId)) {
                resolve(rooms.get(roomId));
            } else {
                resolve(null);
            }
        });
    }

    addClient(roomId: string, clientId: string) {
        return new Promise((resolve, reject) => {
            if (rooms.has(roomId)) {
                rooms.get(roomId).clients.push(clientId);
                resolve(rooms.get(roomId));
            } else {
                reject(new Error('Room not found'));
            }
        });
    }

    removeClient(roomId: string, clientId: string) {
        return new Promise((resolve, reject) => {
            if (rooms.has(roomId)) {
                const index = rooms.get(roomId).clients.indexOf(clientId);
                if (index > -1) {
                    rooms.get(roomId).clients.splice(index, 1);
                    resolve(rooms.get(roomId));
                } else {
                    reject(new Error('Client not found'));
                }
            } else {
                reject(new Error('Room not found'));
            }
        });
    }
}
