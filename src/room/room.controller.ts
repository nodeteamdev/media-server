import {
    Body,
    Controller, Get, Post, Render, Param, Delete,
} from '@nestjs/common';
import { RoomService } from './room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { DeleteRoomDto } from './dto/delete-room.dto';

@Controller('room')
export class RoomController {
    constructor(private readonly roomService: RoomService) {}

  @Get('/list')
  @Render('rooms')
    async rooms() {
        const rooms = await this.roomService.findAll();

        return {
            rooms,
        };
    }

  @Get('/watch/:id')
  @Render('room-watch')
  async watch() {
      return {};
  }

  @Post('/create')
  async create(@Body() createRoomDto: CreateRoomDto) {
      const room = await this.roomService.create(createRoomDto);

      return {
          data: {
              id: room._id,
              name: room.name,
          },
      };
  }

  @Delete('/delete')
  async delete(@Body() deleteRoomDto: DeleteRoomDto) {
      const room = await this.roomService.deleteOne(deleteRoomDto);

      return {
          data: room,
      };
  }

  @Get('/:id')
  @Render('room')
  async roomInside(@Param() params: { id: string }) {
      console.log(params.id);

      return {};
  }
}
