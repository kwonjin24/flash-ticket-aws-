import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, Connection, ConsumeMessage, connect } from 'amqplib';
import { PaymentRequestMessage, PaymentResultMessage } from './payment-message.types';

@Injectable()
export class PaymentQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentQueueService.name);
  private connection: Connection | null = null;
  private requestChannel: Channel | null = null;
  private resultChannel: Channel | null = null;
  private resultConsumerTag: string | null = null;
  private resultHandler?: (message: PaymentResultMessage) => Promise<void>;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.initialize();
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.resultChannel && this.resultConsumerTag) {
        await this.resultChannel.cancel(this.resultConsumerTag);
      }
      await this.requestChannel?.close();
      await this.resultChannel?.close();
      await this.connection?.close();
    } catch (error) {
      this.logger.error('Failed to close RabbitMQ resources', error as Error);
    }
  }

  async publishPaymentRequest(payload: PaymentRequestMessage): Promise<void> {
    await this.initialize();
    if (!this.requestChannel) {
      throw new Error('Payment request channel is not available');
    }

    const buffer = Buffer.from(JSON.stringify(payload));
    const sent = this.requestChannel.sendToQueue(
      this.getRequestQueueName(),
      buffer,
      {
        persistent: true,
        contentType: 'application/json',
        messageId: payload.requestId,
        correlationId: payload.requestId,
      },
    );

    if (!sent) {
      this.logger.warn('Payment request send returned false (queue may be full)', {
        requestId: payload.requestId,
      });
    }
  }

  async registerResultHandler(
    handler: (message: PaymentResultMessage) => Promise<void>,
  ): Promise<void> {
    this.resultHandler = handler;
    await this.startConsuming();
  }

  private async initialize(): Promise<void> {
    if (this.connection) {
      return;
    }

    const amqpUrl = this.getAmqpUrl();
    this.connection = await connect(amqpUrl);
    this.requestChannel = await this.connection.createChannel();
    this.resultChannel = await this.connection.createChannel();

    const requestQueue = this.getRequestQueueName();
    const resultQueue = this.getResultQueueName();

    await this.requestChannel.assertQueue(requestQueue, { durable: true });
    await this.resultChannel.assertQueue(resultQueue, { durable: true });
    this.resultChannel.prefetch(1);

    this.logger.log('Connected to RabbitMQ', {
      requestQueue,
      resultQueue,
    });

    if (this.resultHandler) {
      await this.startConsuming();
    }
  }

  private async startConsuming(): Promise<void> {
    await this.initialize();
    if (!this.resultChannel || !this.resultHandler) {
      return;
    }

    if (this.resultConsumerTag) {
      return;
    }

    const resultQueue = this.getResultQueueName();
    const consumeResult = await this.resultChannel.consume(
      resultQueue,
      async (message) => {
        if (!message) {
          return;
        }
        await this.handleResultMessage(message);
      },
      { noAck: false },
    );

    this.resultConsumerTag = consumeResult.consumerTag;
    this.logger.log('Registered payment result consumer', {
      queue: resultQueue,
      consumerTag: this.resultConsumerTag,
    });
  }

  private async handleResultMessage(message: ConsumeMessage): Promise<void> {
    if (!this.resultChannel || !this.resultHandler) {
      return;
    }

    try {
      const payload = JSON.parse(message.content.toString()) as PaymentResultMessage;
      await this.resultHandler(payload);
      this.resultChannel.ack(message);
    } catch (error) {
      this.logger.error('Failed to process payment result message', error as Error, {
        content: message.content.toString(),
      });
      this.resultChannel.nack(message, false, false);
    }
  }

  private getAmqpUrl(): string {
    const directUrl = this.configService.get<string>('RABBITMQ_URL');
    if (directUrl) {
      return directUrl;
    }

    const host = this.configService.get<string>('RABBITMQ_HOST') ?? '127.0.0.1';
    const port = Number(this.configService.get<number>('RABBITMQ_PORT') ?? 5672);
    const user = this.configService.get<string>('RABBITMQ_USER') ?? 'guest';
    const password =
      this.configService.get<string>('RABBITMQ_PASSWORD') ?? 'guest';
    const vhost = this.configService.get<string>('RABBITMQ_VHOST') ?? '/';

    const encodedUser = encodeURIComponent(user);
    const encodedPass = encodeURIComponent(password);
    const encodedVhost = encodeURIComponent(vhost);

    return `amqp://${encodedUser}:${encodedPass}@${host}:${port}/${encodedVhost}`;
  }

  private getRequestQueueName(): string {
    return this.configService.get<string>('PAYMENT_REQUEST_QUEUE') ?? 'payments_request';
  }

  private getResultQueueName(): string {
    return this.configService.get<string>('PAYMENT_RESULT_QUEUE') ?? 'payments_result';
  }
}
