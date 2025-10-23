import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateEventDto } from '../../../application/events/dto/create-event.dto';
import { UpdateEventDto } from '../../../application/events/dto/update-event.dto';
import { EventsFacade } from '../../../application/events/facades/events.facade';
import { UserRole } from '../../../domain/auth/enums/user-role.enum';
import { JwtAuthGuard } from '@auth/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { EventResponseDto } from '../dto/event-response.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsFacade: EventsFacade) {}

  @Get()
  async list(): Promise<EventResponseDto[]> {
    const events = await this.eventsFacade.findPublic();
    return events.map(EventResponseDto.fromEntity);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async listAll(): Promise<EventResponseDto[]> {
    const events = await this.eventsFacade.findAll();
    return events.map(EventResponseDto.fromEntity);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async create(@Body() dto: CreateEventDto): Promise<EventResponseDto> {
    const event = await this.eventsFacade.create(dto);
    return EventResponseDto.fromEntity(event);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<EventResponseDto> {
    const event = await this.eventsFacade.findOne(id);
    return EventResponseDto.fromEntity(event);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ): Promise<EventResponseDto> {
    const event = await this.eventsFacade.update(id, dto);
    return EventResponseDto.fromEntity(event);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async delete(@Param('id') id: string): Promise<{ message: string }> {
    await this.eventsFacade.delete(id);
    return { message: 'Event deleted successfully' };
  }
}
