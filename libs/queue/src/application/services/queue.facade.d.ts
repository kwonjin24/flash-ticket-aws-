import { QueueTicketService } from './queue-ticket.service';
export declare class QueueFacade {
    private readonly queueTicketService;
    constructor(queueTicketService: QueueTicketService);
    enqueue(userId: string, eventId: string): Promise<{
        ticketId: string;
    }>;
    getStatus(ticketId: string): Promise<{
        state: import("../types/queue-ticket-state.type").QueueTicketState;
        position?: number;
        gateToken?: string;
    }>;
    enter(userId: string, ticketId: string, gateToken: string): Promise<void>;
}
