declare module 'amqplib' {
  export interface ConsumeMessage {
    content: Buffer;
    fields: Record<string, unknown>;
    properties: Record<string, unknown>;
  }

  export interface Channel {
    assertQueue(queue: string, options?: Record<string, unknown>): Promise<unknown>;
    consume(
      queue: string,
      onMessage: (msg: ConsumeMessage | null) => void,
      options?: Record<string, unknown>,
    ): Promise<{ consumerTag: string }>;
    sendToQueue(
      queue: string,
      content: Buffer,
      options?: Record<string, unknown>,
    ): boolean;
    ack(message: ConsumeMessage): void;
    nack(message: ConsumeMessage, allUpTo?: boolean, requeue?: boolean): void;
    prefetch(count: number): void;
    cancel(consumerTag: string): Promise<void>;
    close(): Promise<void>;
  }

  export interface Connection {
    createChannel(): Promise<Channel>;
    close(): Promise<void>;
  }

  export function connect(url: string): Promise<Connection>;
}
