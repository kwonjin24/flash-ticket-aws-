import { Order } from '../../../domain/orders/entities/order.entity';

export class OrderDetailResponseDto {
  id: string;
  status: string;
  amount: number;
  qty: number;
  eventId: string;
  eventName?: string;
  createdAt: string;
  updatedAt: string;

  private static formatDate(value: Date | string | null | undefined): string {
    if (!value) {
      return '';
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? `${value}` : parsed.toISOString();
  }

  static fromEntity(order: Order): OrderDetailResponseDto {
    return {
      id: order.id,
      status: order.status,
      amount: order.amount,
      qty: order.qty,
      eventId: order.eventId,
      eventName: order.event?.name,
      createdAt: OrderDetailResponseDto.formatDate(order.createdAt),
      updatedAt: OrderDetailResponseDto.formatDate(order.updatedAt),
    };
  }
}
