import { Expose } from 'class-transformer';
import { IsInt, IsPositive, IsUUID } from 'class-validator';

export class CreateOrderRequestDto {
  @IsUUID()
  @Expose({ name: 'event_id' })
  eventId: string;

  @IsInt()
  @IsPositive()
  qty: number;
}
