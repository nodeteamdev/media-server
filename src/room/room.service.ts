import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CreateRoomDto } from './dto/create-room.dto';
import { Room, RoomDocument } from './schemas/room.schema';

@Injectable()
export class RoomService {
    constructor(@InjectModel(Room.name) private roomModel: Model<RoomDocument>) {
    }

    findAll() {
        return this.roomModel.find({});
    }

    deleteOne(deleteRoomDto) {
        return this.roomModel.deleteOne(deleteRoomDto);
    }

    create(createRoomDto: CreateRoomDto) {
        return this.roomModel.create({
            name: createRoomDto.roomName,
        });
    }
}
