import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateOrderDto } from '../../../application/orders/dto/create-order.dto';
import { OrdersFacade } from '../../../application/orders/facades/orders.facade';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { User } from '../../../domain/auth/entities/user.entity';
import { CreateOrderRequestDto } from '../dto/create-order-request.dto';
import { OrderDetailResponseDto } from '../dto/order-detail-response.dto';
import { OrderResponseDto } from '../dto/order-response.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersFacade: OrdersFacade) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() body: CreateOrderRequestDto,
    @Headers('x-gate-token') gateToken: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @CurrentUser() user: User,
  ): Promise<OrderResponseDto> {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    if (!gateToken) {
      throw new BadRequestException('X-Gate-Token header is required');
    }

    const payload: CreateOrderDto = {
      eventId: body.eventId,
      qty: body.qty,
      gateToken,
      idempotencyKey,
      userId: user.id,
    };

    const order = await this.ordersFacade.create(payload);
    return OrderResponseDto.fromEntity(order);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@CurrentUser() user: User): Promise<OrderDetailResponseDto[]> {
    const orders = await this.ordersFacade.listForUser(user);
    return orders.map((order) => OrderDetailResponseDto.fromEntity(order));
  }

  @Get(':orderId')
  @UseGuards(JwtAuthGuard)
  async detail(
    @Param('orderId') orderId: string,
    @CurrentUser() user: User,
  ): Promise<OrderDetailResponseDto> {
    const order = await this.ordersFacade.findById(orderId, user);
    return OrderDetailResponseDto.fromEntity(order);
  }
}
