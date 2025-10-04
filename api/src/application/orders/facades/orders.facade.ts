import { Injectable } from '@nestjs/common';
import { User } from '../../../domain/auth/entities/user.entity';
import { Order } from '../../../domain/orders/entities/order.entity';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrdersService } from '../services/orders.service';

@Injectable()
export class OrdersFacade {
  constructor(private readonly ordersService: OrdersService) {}

  create(dto: CreateOrderDto): Promise<Order> {
    return this.ordersService.createOrder(dto);
  }

  findById(orderId: string, user: User): Promise<Order> {
    return this.ordersService.getOrderForUser(orderId, user);
  }

  listForUser(user: User): Promise<Order[]> {
    return this.ordersService.listOrdersForUser(user);
  }
}
