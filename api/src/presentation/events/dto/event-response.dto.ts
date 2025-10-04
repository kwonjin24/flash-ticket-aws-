import { Event } from '../../../domain/events/entities/event.entity';

export class EventResponseDto {
  id: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  totalQty: number;
  soldQty: number;
  maxPerUser: number;
  price: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(event: Event): EventResponseDto {
    return {
      id: event.id,
      name: event.name,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      totalQty: event.totalQty,
      soldQty: event.soldQty,
      maxPerUser: event.maxPerUser,
      price: event.price,
      status: event.status,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }
}
