import { types } from 'mediasoup';

const rooms = new Map();
const producerTransports = new Map();
const consumerTransports = new Map();
const producers = new Map();
const consumers = new Map();

export class Room {
    clients: [] = [];

    router: null | types.Router = null;

    constructor(roomId: string) {
        this.clients = [];

        rooms.set(roomId, this);
    }

    get rooms() {
        return rooms;
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

    static setProducer(roomId: string, producer: types.Producer) {
        return producers.set(roomId, producer);
    }

    static getProducer(socketId: string) {
        return producers.get(socketId);
    }

    static setConsumer(socketId: string, consumer: types.Consumer) {
        return consumers.set(socketId, consumer);
    }

    static getConsumer(socketId: string) {
        return consumers.get(socketId);
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
