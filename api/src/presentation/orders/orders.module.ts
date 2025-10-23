import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersFacade } from '../../application/orders/facades/orders.facade';
import { OrdersService } from '../../application/orders/services/orders.service';
import { Event } from '../../domain/events/entities/event.entity';
import { Order } from '../../domain/orders/entities/order.entity';
import { AuthModule } from '../auth/auth.module';
import { OrdersController } from './controllers/orders.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Event]), AuthModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersFacade],
})
export class OrdersModule {}
