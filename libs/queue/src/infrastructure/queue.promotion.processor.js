"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var QueuePromotionProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueuePromotionProcessor = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const ioredis_1 = require("ioredis");
const queue_ticket_service_1 = require("../application/services/queue-ticket.service");
const redis_provider_1 = require("./redis.provider");
const PROMOTION_QUEUE = 'queue-ticket-promotion';
const PROMOTION_JOB_ID = 'queue-ticket-promotion-job';
let QueuePromotionProcessor = QueuePromotionProcessor_1 = class QueuePromotionProcessor {
    redis;
    queueTicketService;
    logger = new common_1.Logger(QueuePromotionProcessor_1.name);
    queue;
    worker;
    constructor(redis, queueTicketService) {
        this.redis = redis;
        this.queueTicketService = queueTicketService;
    }
    async onModuleInit() {
        this.queue = new bullmq_1.Queue(PROMOTION_QUEUE, {
            connection: this.redis.duplicate(),
        });
        this.worker = new bullmq_1.Worker(PROMOTION_QUEUE, async () => {
            try {
                await this.queueTicketService.promoteTickets();
            }
            catch (error) {
                this.logger.error('Failed to promote tickets', error);
                throw error;
            }
        }, {
            autorun: true,
            connection: this.redis.duplicate(),
        });
        const repeatEvery = this.queueTicketService.getPromotionIntervalMs();
        const nodeEnv = process.env.NODE_ENV ?? 'local';
        if (nodeEnv !== 'production') {
            try {
                await this.queue.obliterate({ force: true });
            }
            catch (error) {
                this.logger.warn(`Failed to obliterate queue during init: ${error.message}`);
            }
        }
        const repeatables = await this.queue.getRepeatableJobs();
        for (const job of repeatables) {
            if (job.name === 'promote') {
                await this.queue.removeRepeatableByKey(job.key);
            }
        }
        await this.queue.drain(true);
        await this.queue.clean(0, 1000, 'completed');
        await this.queue.clean(0, 1000, 'failed');
        await this.queue.add('promote', {}, {
            jobId: PROMOTION_JOB_ID,
            repeat: {
                every: repeatEvery,
            },
            removeOnComplete: true,
            removeOnFail: true,
        });
    }
    async onModuleDestroy() {
        if (this.worker) {
            await this.worker.close();
        }
        if (this.queue) {
            await this.queue.close();
        }
    }
};
exports.QueuePromotionProcessor = QueuePromotionProcessor;
exports.QueuePromotionProcessor = QueuePromotionProcessor = QueuePromotionProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_provider_1.REDIS_QUEUE_CLIENT)),
    __metadata("design:paramtypes", [ioredis_1.Redis,
        queue_ticket_service_1.QueueTicketService])
], QueuePromotionProcessor);
//# sourceMappingURL=queue.promotion.processor.js.map