import { IsIn, IsUUID } from 'class-validator';

export class PaymentCallbackRequestDto {
  @IsUUID()
  orderId: string;

  @IsUUID()
  paymentId: string;

  @IsIn(['OK', 'FAIL'])
  status: 'OK' | 'FAIL';
}
