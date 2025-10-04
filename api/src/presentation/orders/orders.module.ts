import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersFacade } from '../../application/orders/facades/orders.facade';
import { GateTokenService } from '../../application/orders/services/gate-token.service';
import { OrdersService } from '../../application/orders/services/orders.service';
import { Event } from '../../domain/events/entities/event.entity';
import { Order } from '../../domain/orders/entities/order.entity';
import { AuthModule } from '../auth/auth.module';
import { QueueModule } from '../queue/queue.module';
import { OrdersController } from './controllers/orders.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Event]), AuthModule, QueueModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersFacade, GateTokenService],
})
export class OrdersModule {}
