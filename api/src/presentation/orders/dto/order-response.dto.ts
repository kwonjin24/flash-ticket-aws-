import { Order } from '../../../domain/orders/entities/order.entity';

export class OrderResponseDto {
  orderId: string;
  status: string;
  amount: number;
  qty: number;
  eventId: string;
  eventName?: string;

  static fromEntity(order: Order): OrderResponseDto {
    return {
      orderId: order.id,
      status: order.status,
      amount: order.amount,
      qty: order.qty,
      eventId: order.eventId,
      eventName: order.event?.name,
    };
  }
}
