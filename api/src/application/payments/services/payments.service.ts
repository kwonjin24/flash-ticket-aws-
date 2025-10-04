import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Event } from '../../../domain/events/entities/event.entity';
import { Order } from '../../../domain/orders/entities/order.entity';
import { OrderStatus } from '../../../domain/orders/enums/order-status.enum';
import { Payment } from '../../../domain/payments/entities/payment.entity';
import { PaymentStatus } from '../../../domain/payments/enums/payment-status.enum';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { CompletePaymentDto } from '../dto/complete-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async createPayment(dto: CreatePaymentDto): Promise<Payment> {
    const order = await this.ordersRepository.findOne({
      where: { id: dto.orderId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== dto.userId) {
      throw new UnauthorizedException('Order does not belong to this user');
    }

    if (order.status === OrderStatus.PAID) {
      const successfulPayment = await this.paymentsRepository.findOne({
        where: { orderId: dto.orderId, status: PaymentStatus.OK },
        order: { createdAt: 'DESC' },
      });
      if (successfulPayment) {
        return successfulPayment;
      }
      throw new BadRequestException('Order is already paid');
    }

    if (order.status !== OrderStatus.HOLD) {
      throw new BadRequestException('Order is not eligible for payment');
    }

    const existingPending = await this.paymentsRepository.findOne({
      where: { orderId: dto.orderId, status: PaymentStatus.REQ },
      order: { createdAt: 'DESC' },
    });
    if (existingPending) {
      return existingPending;
    }

    const payment = this.paymentsRepository.create({
      orderId: order.id,
      amount: order.amount,
      method: dto.method,
      status: PaymentStatus.REQ,
    });

    return this.paymentsRepository.save(payment);
  }

  async completePayment(dto: CompletePaymentDto): Promise<Payment> {
    const normalizedStatus =
      dto.status === 'OK' ? PaymentStatus.OK : PaymentStatus.FAIL;

    return this.dataSource.transaction(async (manager) => {
      const paymentsRepo = manager.getRepository(Payment);
      const ordersRepo = manager.getRepository(Order);
      const eventsRepo = manager.getRepository(Event);

      const payment = await paymentsRepo.findOne({
        where: { id: dto.paymentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      if (payment.orderId !== dto.orderId) {
        throw new BadRequestException(
          'Payment does not belong to the provided order',
        );
      }

      const order = await ordersRepo.findOne({
        where: { id: dto.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.userId !== dto.userId) {
        throw new UnauthorizedException('Order does not belong to this user');
      }

      if (normalizedStatus === PaymentStatus.OK) {
        if (payment.status === PaymentStatus.OK) {
          return payment;
        }

        if (
          order.status !== OrderStatus.HOLD &&
          order.status !== OrderStatus.PAID
        ) {
          throw new BadRequestException(
            'Order cannot be completed for payment',
          );
        }

        payment.status = PaymentStatus.OK;
        await paymentsRepo.save(payment);

        if (order.status !== OrderStatus.PAID) {
          order.status = OrderStatus.PAID;
          await ordersRepo.save(order);

          const event = await eventsRepo.findOne({
            where: { id: order.eventId },
            lock: { mode: 'pessimistic_write' },
          });
          if (!event) {
            throw new NotFoundException('Event not found for order');
          }

          const nextSoldQty = event.soldQty + order.qty;
          if (nextSoldQty > event.totalQty) {
            throw new BadRequestException(
              'Sold quantity exceeds event capacity',
            );
          }

          event.soldQty = nextSoldQty;
          await eventsRepo.save(event);
        }

        return payment;
      }

      if (payment.status === PaymentStatus.OK) {
        throw new BadRequestException(
          'Payment has already been completed successfully',
        );
      }

      if (payment.status !== PaymentStatus.FAIL) {
        payment.status = PaymentStatus.FAIL;
        await paymentsRepo.save(payment);
      }

      return payment;
    });
  }
}
