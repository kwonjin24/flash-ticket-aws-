import { Injectable } from '@nestjs/common';
import { Event } from '../../../domain/events/entities/event.entity';
import { CreateEventDto } from '../dto/create-event.dto';
import { UpdateEventDto } from '../dto/update-event.dto';
import { EventsService } from '../services/events.service';

@Injectable()
export class EventsFacade {
  constructor(private readonly eventsService: EventsService) {}

  create(dto: CreateEventDto): Promise<Event> {
    return this.eventsService.createEvent(dto);
  }

  findOne(id: string): Promise<Event> {
    return this.eventsService.getEventById(id);
  }

  findPublic(): Promise<Event[]> {
    return this.eventsService.listPublicEvents();
  }

  update(id: string, dto: UpdateEventDto): Promise<Event> {
    return this.eventsService.patchEvent(id, dto);
  }
}
