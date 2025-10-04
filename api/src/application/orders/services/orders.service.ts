import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Event } from '../../../domain/events/entities/event.entity';
import { EventStatus } from '../../../domain/events/enums/event-status.enum';
import { Order } from '../../../domain/orders/entities/order.entity';
import { OrderStatus } from '../../../domain/orders/enums/order-status.enum';
import { User } from '../../../domain/auth/entities/user.entity';
import { UserRole } from '../../../domain/auth/enums/user-role.enum';
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
    const existingOrder = await this.ordersRepository.findOne({
      where: { idemKey: dto.idempotencyKey },
      relations: ['event'],
    });
    if (existingOrder) {
      return existingOrder;
    }

    const { ticketId } = await this.gateTokenService.lockForOrder(
      dto.gateToken,
      dto.userId,
      dto.eventId,
    );

    try {
      const order = await this.dataSource.transaction(async (manager) => {
        const event = await manager
          .getRepository(Event)
          .findOne({ where: { id: dto.eventId } });
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
          throw new BadRequestException(
            'Requested quantity exceeds per-user limit',
          );
        }

        const orderEntity = manager.getRepository(Order).create({
          userId: dto.userId,
          eventId: dto.eventId,
          qty: dto.qty,
          status: OrderStatus.HOLD,
          amount: dto.qty * event.price,
          idemKey: dto.idempotencyKey,
        });

        const savedOrder = await manager.getRepository(Order).save(orderEntity);
        const orderWithEvent = await manager.getRepository(Order).findOne({
          where: { id: savedOrder.id },
          relations: ['event'],
        });
        if (!orderWithEvent) {
          throw new Error('Order not found after creation');
        }
        return orderWithEvent;
      });

      await this.gateTokenService.markOrderSuccess(
        ticketId,
        dto.gateToken,
        order.id,
      );
      return order;
    } catch (error) {
      await this.gateTokenService.releaseLock(ticketId);
      throw error;
    }
  }

  async getOrderForUser(orderId: string, user: User): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: ['event'],
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (user.role !== UserRole.ADMIN && order.userId !== user.id) {
      throw new UnauthorizedException('Order does not belong to this user');
    }

    return order;
  }

  async listOrdersForUser(user: User): Promise<Order[]> {
    const where = user.role === UserRole.ADMIN ? {} : { userId: user.id };
    return this.ordersRepository.find({
      where,
      relations: ['event'],
      order: { createdAt: 'DESC' },
    });
  }
}
