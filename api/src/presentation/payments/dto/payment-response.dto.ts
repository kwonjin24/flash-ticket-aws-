import { Payment } from '../../../domain/payments/entities/payment.entity';

export class PaymentResponseDto {
  paymentId: string;
  orderId: string;
  status: string;
  method: string;
  amount: number;
  createdAt: string;
  updatedAt: string;

  private static formatDate(value: Date | string | null | undefined): string {
    if (!value) {
      return '';
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? `${value}` : parsed.toISOString();
  }

  static fromEntity(payment: Payment): PaymentResponseDto {
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      status: payment.status,
      method: payment.method,
      amount: payment.amount,
      createdAt: PaymentResponseDto.formatDate(payment.createdAt),
      updatedAt: PaymentResponseDto.formatDate(payment.updatedAt),
    };
  }
}
