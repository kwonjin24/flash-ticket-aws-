import { IsInt, IsPositive, IsString, IsUUID } from 'class-validator';

export class CreateOrderDto {
  @IsUUID()
  eventId: string;

  @IsInt()
  @IsPositive()
  qty: number;

  @IsString()
  idempotencyKey: string;

  @IsString()
  userId: string;
}
