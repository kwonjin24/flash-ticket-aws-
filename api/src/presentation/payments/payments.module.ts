import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsFacade } from '../../application/payments/facades/payments.facade';
import { PaymentsService } from '../../application/payments/services/payments.service';
import { Event } from '../../domain/events/entities/event.entity';
import { Order } from '../../domain/orders/entities/order.entity';
import { Payment } from '../../domain/payments/entities/payment.entity';
import { AuthModule } from '../auth/auth.module';
import { PaymentsController } from './controllers/payments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Order, Event]), AuthModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsFacade],
})
export class PaymentsModule {}
