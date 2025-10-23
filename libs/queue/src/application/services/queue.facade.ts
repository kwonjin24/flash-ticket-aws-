import { Injectable } from '@nestjs/common';
import { QueueTicketService } from './queue-ticket.service';

@Injectable()
export class QueueFacade {
  constructor(private readonly queueTicketService: QueueTicketService) {}

  enqueue(userId: string, eventId: string) {
    return this.queueTicketService.enqueue(userId, eventId);
  }

  getStatus(ticketId: string) {
    return this.queueTicketService.getStatus(ticketId);
  }

  enter(userId: string, ticketId: string, gateToken: string) {
    return this.queueTicketService.enter(userId, ticketId, gateToken);
  }
}
