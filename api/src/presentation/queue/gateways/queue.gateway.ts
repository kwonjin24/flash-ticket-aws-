import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { QueueFacade } from '../../../application/queue/services/queue.facade';
import { QueueTicketService } from '../../../application/queue/services/queue-ticket.service';

const DEFAULT_REFRESH_INTERVAL_MS = 3000;

type ClientContext = {
  eventId?: string;
  ticketId?: string;
  interval?: NodeJS.Timeout;
};

type JoinQueuePayload = {
  eventId: string;
  userId: string;
};

type LeaveQueuePayload = {
  clearTicket?: boolean;
};

@WebSocketGateway({ namespace: 'queue', cors: { origin: '*', credentials: true } })
export class QueueGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(QueueGateway.name);
  private readonly contexts = new Map<string, ClientContext>();
  private readonly refreshIntervalMs: number;
  private readonly readyCapacity: number;

  constructor(
    private readonly queueFacade: QueueFacade,
    private readonly queueTicketService: QueueTicketService,
    private readonly configService: ConfigService,
  ) {
    this.refreshIntervalMs = Number(
      this.configService.get('QUEUE_WS_REFRESH_MS') ?? DEFAULT_REFRESH_INTERVAL_MS,
    );
    this.readyCapacity = this.queueTicketService.getReadyCapacity();
  }

  handleConnection(client: Socket): void {
    this.contexts.set(client.id, {});
    client.emit('queue:config', {
      readyCapacity: this.readyCapacity,
    });
  }

  handleDisconnect(client: Socket): void {
    this.stopTracking(client.id);
    this.contexts.delete(client.id);
  }

  @SubscribeMessage('queue/join')
  async joinQueue(@ConnectedSocket() client: Socket, @MessageBody() payload: JoinQueuePayload): Promise<void> {
    if (!payload?.eventId || !payload?.userId) {
      client.emit('queue:error', { message: 'eventId and userId are required to join the queue.' });
      return;
    }

    try {
      const { ticketId } = await this.queueFacade.enqueue(payload.userId, payload.eventId);
      const context = this.upsertContext(client.id);
      context.eventId = payload.eventId;
      context.ticketId = ticketId;
      client.join(payload.eventId);
      await this.emitStatus(client, context);
      this.startTracking(client, context);
      client.emit('queue:joined', {
        ticketId,
        eventId: payload.eventId,
      });
    } catch (error) {
      this.logger.error('Failed to join queue', error as Error);
      client.emit('queue:error', { message: '대기열에 참여하지 못했습니다. 잠시 후 다시 시도해주세요.' });
    }
  }

  @SubscribeMessage('queue/leave')
  leaveQueue(@ConnectedSocket() client: Socket, @MessageBody() payload?: LeaveQueuePayload): void {
    const context = this.contexts.get(client.id);
    if (context?.eventId) {
      client.leave(context.eventId);
    }
    if (payload?.clearTicket) {
      if (context) {
        context.ticketId = undefined;
      }
    }
    this.stopTracking(client.id);
    client.emit('queue:left');
  }

  private upsertContext(clientId: string): ClientContext {
    let context = this.contexts.get(clientId);
    if (!context) {
      context = {};
      this.contexts.set(clientId, context);
    }
    return context;
  }

  private startTracking(client: Socket, context: ClientContext): void {
    this.stopTracking(client.id);
    if (!context.ticketId || !context.eventId) {
      return;
    }
    const interval = setInterval(() => {
      this.emitStatus(client, context).catch((error) => {
        this.logger.error('Failed to emit queue status', error as Error);
      });
    }, this.refreshIntervalMs);
    context.interval = interval;
  }

  private stopTracking(clientId: string): void {
    const context = this.contexts.get(clientId);
    if (context?.interval) {
      clearInterval(context.interval);
      context.interval = undefined;
    }
  }

  private async emitStatus(client: Socket, context: ClientContext): Promise<void> {
    if (!context.ticketId || !context.eventId) {
      return;
    }

    try {
      const [status, queueSize] = await Promise.all([
        this.queueFacade.getStatus(context.ticketId),
        this.queueTicketService.getQueueLength(context.eventId),
      ]);

      const payload = {
        ticketId: context.ticketId,
        eventId: context.eventId,
        queueSize,
        readyCapacity: this.readyCapacity,
        state: status.state,
        position: status.position,
        gateToken: status.gateToken,
      } as const;

      client.emit('queue:update', payload);
      this.server.to(context.eventId).emit('queue:summary', {
        eventId: context.eventId,
        queueSize,
        readyCapacity: this.readyCapacity,
      });

      if (status.state === 'EXPIRED' || status.state === 'USED') {
        this.stopTracking(client.id);
      }
    } catch (error) {
      this.logger.error('Failed to fetch queue status', error as Error);
      client.emit('queue:error', { message: '대기열 상태를 조회하지 못했습니다.' });
      this.stopTracking(client.id);
    }
  }
}
