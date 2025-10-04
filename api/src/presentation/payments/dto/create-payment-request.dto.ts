import { IsString, IsUUID, Length } from 'class-validator';

export class CreatePaymentRequestDto {
  @IsUUID()
  orderId: string;

  @IsString()
  @Length(1, 64)
  method: string;
}
