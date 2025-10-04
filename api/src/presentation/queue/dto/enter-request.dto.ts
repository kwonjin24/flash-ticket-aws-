import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class EnterQueueRequestDto {
  @IsUUID()
  ticketId: string;

  @IsString()
  @IsNotEmpty()
  gateToken: string;
}
