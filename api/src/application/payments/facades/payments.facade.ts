import { Injectable } from '@nestjs/common';
import { Payment } from '../../../domain/payments/entities/payment.entity';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { CompletePaymentDto } from '../dto/complete-payment.dto';
import { PaymentsService } from '../services/payments.service';

@Injectable()
export class PaymentsFacade {
  constructor(private readonly paymentsService: PaymentsService) {}

  create(dto: CreatePaymentDto): Promise<Payment> {
    return this.paymentsService.createPayment(dto);
  }

  complete(dto: CompletePaymentDto): Promise<Payment> {
    return this.paymentsService.completePayment(dto);
  }
}
