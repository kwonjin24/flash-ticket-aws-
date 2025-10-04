import { Expose, Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsPositive, IsString, Max, MaxLength, Min } from 'class-validator';
import { EventStatus } from '../../../domain/events/enums/event-status.enum';

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Expose({ name: 'name' })
  name?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  @Expose({ name: 'starts_at' })
  startsAt?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  @Expose({ name: 'ends_at' })
  endsAt?: Date;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(1000000)
  @Expose({ name: 'total_qty' })
  totalQty?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(100)
  @Expose({ name: 'max_per_user' })
  maxPerUser?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}
