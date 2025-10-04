import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { QueueFacade } from '../../../application/queue/services/queue.facade';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { User } from '../../../domain/auth/entities/user.entity';
import { EnqueueRequestDto } from '../dto/enqueue-request.dto';
import { EnterQueueRequestDto } from '../dto/enter-request.dto';
import { QueueStatusResponseDto } from '../dto/status-response.dto';

@Controller('queue')
export class QueueController {
  constructor(private readonly queueFacade: QueueFacade) {}

  @Post('enqueue')
  @UseGuards(JwtAuthGuard)
  async enqueue(@CurrentUser() user: User, @Body() dto: EnqueueRequestDto): Promise<{ ticketId: string }> {
    return this.queueFacade.enqueue(user.id, dto.eventId);
  }

  @Get('status')
  async status(@Query('ticketId') ticketId?: string): Promise<QueueStatusResponseDto> {
    if (!ticketId) {
      throw new BadRequestException('ticketId query parameter is required');
    }
    const result = await this.queueFacade.getStatus(ticketId);
    return {
      ticketId,
      ...result,
    };
  }

  @Post('enter')
  @UseGuards(JwtAuthGuard)
  async enter(
    @CurrentUser() user: User,
    @Body() dto: EnterQueueRequestDto,
  ): Promise<{ status: 'entered' }> {
    await this.queueFacade.enter(user.id, dto.ticketId, dto.gateToken);
    return { status: 'entered' };
  }
}
