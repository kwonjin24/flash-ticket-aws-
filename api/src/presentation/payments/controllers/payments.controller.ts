import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PaymentsFacade } from '../../../application/payments/facades/payments.facade';
import { CreatePaymentDto } from '../../../application/payments/dto/create-payment.dto';
import { CompletePaymentDto } from '../../../application/payments/dto/complete-payment.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { User } from '../../../domain/auth/entities/user.entity';
import { CreatePaymentRequestDto } from '../dto/create-payment-request.dto';
import { PaymentCallbackRequestDto } from '../dto/payment-callback-request.dto';
import { PaymentResponseDto } from '../dto/payment-response.dto';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsFacade: PaymentsFacade) {}

  @Post()
  async create(
    @Body() body: CreatePaymentRequestDto,
    @CurrentUser() user: User,
  ): Promise<PaymentResponseDto> {
    const payload: CreatePaymentDto = {
      orderId: body.orderId,
      method: body.method,
      userId: user.id,
    };

    const payment = await this.paymentsFacade.create(payload);
    return PaymentResponseDto.fromEntity(payment);
  }

  @Post('callback')
  async complete(
    @Body() body: PaymentCallbackRequestDto,
    @CurrentUser() user: User,
  ): Promise<PaymentResponseDto> {
    const payload: CompletePaymentDto = {
      orderId: body.orderId,
      paymentId: body.paymentId,
      status: body.status,
      userId: user.id,
    };

    const payment = await this.paymentsFacade.complete(payload);
    return PaymentResponseDto.fromEntity(payment);
  }
}
