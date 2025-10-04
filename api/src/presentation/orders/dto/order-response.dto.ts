import { Order } from '../../../domain/orders/entities/order.entity';

export class OrderResponseDto {
  orderId: string;
  status: string;
  amount: number;

  static fromEntity(order: Order): OrderResponseDto {
    return {
      orderId: order.id,
      status: order.status,
      amount: order.amount,
    };
  }
}
