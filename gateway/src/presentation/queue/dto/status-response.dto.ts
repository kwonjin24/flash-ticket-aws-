import { QueueTicketState } from '@queue/application/types/queue-ticket-state.type';

export class QueueStatusResponseDto {
  ticketId: string;
  state: QueueTicketState;
  position?: number;
  gateToken?: string;
}
