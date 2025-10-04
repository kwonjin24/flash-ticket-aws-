import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PaymentsService } from '../../application/payments/services/payments.service';
import { PaymentQueueService } from './payment-queue.service';
import { PaymentResultMessage } from './payment-message.types';

@Injectable()
export class PaymentResultConsumer implements OnModuleInit {
  private readonly logger = new Logger(PaymentResultConsumer.name);

  constructor(
    private readonly paymentQueueService: PaymentQueueService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.paymentQueueService.registerResultHandler(async (message) => {
      await this.handleResult(message);
    });
  }

  private async handleResult(message: PaymentResultMessage): Promise<void> {
    this.logger.log('Processing payment result from queue', {
      requestId: message.requestId,
      paymentId: message.paymentId,
      status: message.status,
    });

    try {
      await this.paymentsService.completePayment({
        orderId: message.orderId,
        paymentId: message.paymentId,
        status: message.status,
        userId: message.userId,
      });
    } catch (error) {
      this.logger.error('Failed to finalize payment from queue', error as Error, {
        requestId: message.requestId,
        paymentId: message.paymentId,
        orderId: message.orderId,
        status: message.status,
      });
      throw error;
    }
  }
}
