import { Injectable } from '@nestjs/common';
import { Order } from '../../../domain/orders/entities/order.entity';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrdersService } from '../services/orders.service';

@Injectable()
export class OrdersFacade {
  constructor(private readonly ordersService: OrdersService) {}

  create(dto: CreateOrderDto): Promise<Order> {
    return this.ordersService.createOrder(dto);
  }
}
