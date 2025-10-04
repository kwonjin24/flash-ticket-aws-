import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../../../domain/events/entities/event.entity';
import { EventStatus } from '../../../domain/events/enums/event-status.enum';
import { CreateEventDto } from '../dto/create-event.dto';
import { UpdateEventDto } from '../dto/update-event.dto';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
  ) {}

  async createEvent(dto: CreateEventDto): Promise<Event> {
    if (dto.startsAt >= dto.endsAt) {
      throw new BadRequestException('startsAt must be earlier than endsAt');
    }

    const event = this.eventsRepository.create({
      name: dto.name,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      totalQty: dto.totalQty,
      maxPerUser: dto.maxPerUser,
      price: dto.price,
    });

    return this.eventsRepository.save(event);
  }

  async getEventById(id: string): Promise<Event> {
    const event = await this.eventsRepository.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  async listPublicEvents(): Promise<Event[]> {
    return this.eventsRepository.find({
      where: { status: EventStatus.ONSALE },
      order: { startsAt: 'ASC' },
    });
  }

  async listAllEvents(): Promise<Event[]> {
    return this.eventsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async deleteEvent(id: string): Promise<void> {
    const event = await this.getEventById(id);
    await this.eventsRepository.remove(event);
  }

  async patchEvent(id: string, dto: UpdateEventDto): Promise<Event> {
    const event = await this.getEventById(id);

    if (dto.startsAt && dto.endsAt && dto.startsAt >= dto.endsAt) {
      throw new BadRequestException('startsAt must be earlier than endsAt');
    }

    if (dto.totalQty && dto.totalQty < event.soldQty) {
      throw new BadRequestException(
        'totalQty cannot be less than sold quantity',
      );
    }

    if (dto.status) {
      this.assertStatusTransition(event.status, dto.status);
    }

    const next = this.eventsRepository.merge(event, {
      name: dto.name ?? event.name,
      startsAt: dto.startsAt ?? event.startsAt,
      endsAt: dto.endsAt ?? event.endsAt,
      totalQty: dto.totalQty ?? event.totalQty,
      maxPerUser: dto.maxPerUser ?? event.maxPerUser,
      price: dto.price ?? event.price,
      status: dto.status ?? event.status,
    });

    return this.eventsRepository.save(next);
  }

  private assertStatusTransition(
    current: EventStatus,
    next: EventStatus,
  ): void {
    if (current === next) {
      return;
    }

    const transitions: Record<EventStatus, EventStatus[]> = {
      [EventStatus.DRAFT]: [EventStatus.ONSALE],
      [EventStatus.ONSALE]: [EventStatus.CLOSED],
      [EventStatus.CLOSED]: [],
    };

    if (!transitions[current].includes(next)) {
      throw new BadRequestException(
        `Invalid status transition from ${current} to ${next}`,
      );
    }
  }
}
