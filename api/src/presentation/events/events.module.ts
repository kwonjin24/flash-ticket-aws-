import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsFacade } from '../../application/events/facades/events.facade';
import { EventsService } from '../../application/events/services/events.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Event } from '../../domain/events/entities/event.entity';
import { AuthModule } from '../auth/auth.module';
import { EventsController } from './controllers/events.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Event]), AuthModule],
  controllers: [EventsController],
  providers: [EventsService, EventsFacade, RolesGuard],
  exports: [EventsFacade],
})
export class EventsModule {}
