import { IsUUID } from 'class-validator';

export class EnqueueRequestDto {
  @IsUUID()
  eventId: string;
}
