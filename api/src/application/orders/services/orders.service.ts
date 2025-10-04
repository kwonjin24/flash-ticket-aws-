import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Event } from '../../../domain/events/entities/event.entity';
import { EventStatus } from '../../../domain/events/enums/event-status.enum';
import { Order } from '../../../domain/orders/entities/order.entity';
import { OrderStatus } from '../../../domain/orders/enums/order-status.enum';
import { CreateOrderDto } from '../dto/create-order.dto';
import { GateTokenService } from './gate-token.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly gateTokenService: GateTokenService,
  ) {}

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    const existingOrder = await this.ordersRepository.findOne({ where: { idemKey: dto.idempotencyKey } });
    if (existingOrder) {
      return existingOrder;
    }

    const { ticketId } = await this.gateTokenService.lockForOrder(dto.gateToken, dto.userId, dto.eventId);

    try {
      const order = await this.dataSource.transaction(async (manager) => {
        const event = await manager.getRepository(Event).findOne({ where: { id: dto.eventId } });
        if (!event) {
          throw new NotFoundException('Event not found');
        }

        if (event.status !== EventStatus.ONSALE) {
          throw new BadRequestException('Event is not on sale');
        }

        if (dto.qty > event.totalQty - event.soldQty) {
          throw new BadRequestException('Not enough tickets remaining');
        }

        const userActiveQty = await manager.getRepository(Order).sum('qty', {
          eventId: dto.eventId,
          userId: dto.userId,
          status: In([OrderStatus.HOLD, OrderStatus.PAID]),
        });

        const totalForUser = (userActiveQty ?? 0) + dto.qty;
        if (totalForUser > event.maxPerUser) {
          throw new BadRequestException('Requested quantity exceeds per-user limit');
        }

        const orderEntity = manager.getRepository(Order).create({
          userId: dto.userId,
          eventId: dto.eventId,
          qty: dto.qty,
          status: OrderStatus.HOLD,
          amount: dto.qty * event.price,
          idemKey: dto.idempotencyKey,
        });

        return manager.getRepository(Order).save(orderEntity);
      });

      await this.gateTokenService.markOrderSuccess(ticketId, dto.gateToken, order.id);
      return order;
    } catch (error) {
      await this.gateTokenService.releaseLock(ticketId);
      throw error;
    }
  }
}
