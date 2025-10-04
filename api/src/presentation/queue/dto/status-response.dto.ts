import { QueueTicketState } from '../../../application/queue/types/queue-ticket-state.type';

export class QueueStatusResponseDto {
  ticketId: string;
  state: QueueTicketState;
  position?: number;
  gateToken?: string;
}
