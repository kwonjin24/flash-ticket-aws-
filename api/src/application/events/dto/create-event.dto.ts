import { Expose, Type } from 'class-transformer';
import { IsDate, IsInt, IsPositive, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateEventDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Expose({ name: 'name' })
  name: string;

  @IsDate()
  @Type(() => Date)
  @Expose({ name: 'starts_at' })
  startsAt: Date;

  @IsDate()
  @Type(() => Date)
  @Expose({ name: 'ends_at' })
  endsAt: Date;

  @IsInt()
  @IsPositive()
  @Max(1000000)
  @Expose({ name: 'total_qty' })
  totalQty: number;

  @IsInt()
  @IsPositive()
  @Max(100)
  @Expose({ name: 'max_per_user' })
  maxPerUser: number;

  @IsInt()
  @Min(0)
  price: number;
}
