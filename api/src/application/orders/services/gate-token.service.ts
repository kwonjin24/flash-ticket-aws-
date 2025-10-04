import { Injectable } from '@nestjs/common';
import { QueueTicketService } from '../../queue/services/queue-ticket.service';

@Injectable()
export class GateTokenService {
  constructor(private readonly queueTicketService: QueueTicketService) {}

  lockForOrder(gateToken: string, userId: string, eventId: string) {
    return this.queueTicketService.lockGateTokenForOrder(gateToken, userId, eventId);
  }

  markOrderSuccess(ticketId: string, gateToken: string, orderId: string) {
    return this.queueTicketService.markOrderSuccess(ticketId, gateToken, orderId);
  }

  releaseLock(ticketId: string) {
    return this.queueTicketService.releaseOrderLock(ticketId);
  }
}
