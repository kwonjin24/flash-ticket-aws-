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
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueTicketService = exports.GLOBAL_QUEUE_EVENT_ID = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_crypto_1 = require("node:crypto");
const ioredis_1 = require("ioredis");
const redis_provider_1 = require("../../infrastructure/redis.provider");
const EVENTS_SET_KEY = 'queue:events';
const TICKET_KEY = (ticketId) => `queue:ticket:${ticketId}`;
const QUEUE_KEY = (eventId) => `queue:event:${eventId}:queue`;
const READY_SET_KEY = (eventId) => `queue:event:${eventId}:ready`;
const GATE_TOKEN_KEY = (gateToken) => `queue:ticket:${gateToken}`;
exports.GLOBAL_QUEUE_EVENT_ID = '__global__';
const TICKET_STATE_FIELD = 'state';
const TICKET_EVENT_FIELD = 'eventId';
const TICKET_USER_FIELD = 'userId';
const TICKET_CREATED_AT_FIELD = 'createdAt';
const TICKET_GATE_TOKEN_FIELD = 'gateToken';
const TICKET_EXPIRES_AT_FIELD = 'expiresAt';
const TICKET_USED_AT_FIELD = 'usedAt';
const TICKET_ORDER_ID_FIELD = 'orderId';
let QueueTicketService = class QueueTicketService {
    redis;
    configService;
    promotionIntervalMs;
    gateTokenTtlMs;
    readyCapacity;
    constructor(redis, configService) {
        this.redis = redis;
        this.configService = configService;
        this.readyCapacity = Number(this.configService.get('QUEUE_READY_CAPACITY') ?? 50);
        this.gateTokenTtlMs = Number(this.configService.get('QUEUE_GATE_TOKEN_TTL_MS') ?? 120_000);
        this.promotionIntervalMs = Number(this.configService.get('QUEUE_PROMOTION_INTERVAL_MS') ?? 5_000);
    }
    getPromotionIntervalMs() {
        return this.promotionIntervalMs;
    }
    getReadyCapacity() {
        return this.readyCapacity;
    }
    async getQueueLength(eventId) {
        return this.redis.zcard(QUEUE_KEY(eventId));
    }
    async enqueue(userId, eventId) {
        const ticketId = (0, node_crypto_1.randomUUID)();
        const now = Date.now();
        const multi = this.redis.multi();
        multi.hset(TICKET_KEY(ticketId), {
            [TICKET_USER_FIELD]: userId,
            [TICKET_EVENT_FIELD]: eventId,
            [TICKET_STATE_FIELD]: 'QUEUED',
            [TICKET_CREATED_AT_FIELD]: now.toString(),
        });
        multi.zadd(QUEUE_KEY(eventId), now, ticketId);
        multi.sadd(EVENTS_SET_KEY, eventId);
        await multi.exec();
        return { ticketId };
    }
    async getStatus(ticketId) {
        const ticket = await this.redis.hgetall(TICKET_KEY(ticketId));
        if (!ticket || Object.keys(ticket).length === 0) {
            throw new common_1.NotFoundException('Queue ticket not found');
        }
        await this.refreshExpiration(ticketId, ticket);
        const state = ticket[TICKET_STATE_FIELD] ?? 'QUEUED';
        if (state === 'QUEUED') {
            const rank = await this.redis.zrank(QUEUE_KEY(ticket[TICKET_EVENT_FIELD]), ticketId);
            const position = typeof rank === 'number' ? rank + 1 : undefined;
            return { state, position };
        }
        if (state === 'READY') {
            return {
                state,
                gateToken: ticket[TICKET_GATE_TOKEN_FIELD] ?? undefined,
            };
        }
        return { state };
    }
    async enter(userId, ticketId, gateToken) {
        const ticketKey = TICKET_KEY(ticketId);
        const ticket = await this.redis.hgetall(ticketKey);
        if (!ticket || Object.keys(ticket).length === 0) {
            throw new common_1.NotFoundException('Queue ticket not found');
        }
        await this.refreshExpiration(ticketId, ticket);
        if (ticket[TICKET_USER_FIELD] !== userId) {
            throw new common_1.UnauthorizedException('Ticket does not belong to this user');
        }
        if (ticket[TICKET_STATE_FIELD] !== 'READY') {
            throw new common_1.UnauthorizedException('Ticket is not ready to enter');
        }
        if (ticket[TICKET_GATE_TOKEN_FIELD] !== gateToken) {
            throw new common_1.UnauthorizedException('Gate token mismatch');
        }
        const multi = this.redis.multi();
        const expiresAt = Date.now() + this.gateTokenTtlMs;
        multi.hset(ticketKey, {
            [TICKET_STATE_FIELD]: 'USED',
            [TICKET_USED_AT_FIELD]: Date.now().toString(),
            [TICKET_EXPIRES_AT_FIELD]: expiresAt.toString(),
        });
        multi.srem(READY_SET_KEY(ticket[TICKET_EVENT_FIELD]), ticketId);
        multi.pexpire(GATE_TOKEN_KEY(gateToken), this.gateTokenTtlMs);
        await multi.exec();
    }
    async lockGateTokenForOrder(gateToken, userId, eventId) {
        const ticketId = await this.redis.get(GATE_TOKEN_KEY(gateToken));
        if (!ticketId) {
            throw new common_1.UnauthorizedException('Gate token is invalid or expired');
        }
        const ticketKey = TICKET_KEY(ticketId);
        await this.redis.watch(ticketKey);
        try {
            const ticket = await this.redis.hgetall(ticketKey);
            if (!ticket || Object.keys(ticket).length === 0) {
                throw new common_1.NotFoundException('Queue ticket not found');
            }
            if (ticket[TICKET_USER_FIELD] !== userId) {
                throw new common_1.UnauthorizedException('Gate token does not belong to this user');
            }
            if (ticket[TICKET_EVENT_FIELD] !== eventId &&
                ticket[TICKET_EVENT_FIELD] !== exports.GLOBAL_QUEUE_EVENT_ID) {
                throw new common_1.UnauthorizedException('Gate token does not match event');
            }
            if (ticket[TICKET_STATE_FIELD] !== 'READY') {
                throw new common_1.UnauthorizedException('Gate token has not been entered yet');
            }
            if (ticket[TICKET_ORDER_ID_FIELD]) {
                throw new common_1.UnauthorizedException('Gate token already locked');
            }
            const multi = this.redis.multi();
            multi.hset(ticketKey, {
                [TICKET_STATE_FIELD]: 'ORDER_PENDING',
                [TICKET_ORDER_ID_FIELD]: 'LOCKED',
            });
            const result = await multi.exec();
            if (!result) {
                throw new common_1.UnauthorizedException('Gate token already locked');
            }
            return { ticketId };
        }
        finally {
            await this.redis.unwatch();
        }
    }
    async markOrderSuccess(ticketId, gateToken, orderId) {
        const ticketKey = TICKET_KEY(ticketId);
        const ticket = await this.redis.hgetall(ticketKey);
        if (!ticket || Object.keys(ticket).length === 0) {
            throw new common_1.NotFoundException('Queue ticket not found');
        }
        if (ticket[TICKET_STATE_FIELD] !== 'ORDER_PENDING') {
            throw new common_1.UnauthorizedException('Gate token lock not held');
        }
        const multi = this.redis.multi();
        multi.hset(ticketKey, {
            [TICKET_STATE_FIELD]: 'ORDERED',
            [TICKET_ORDER_ID_FIELD]: orderId,
        });
        multi.del(GATE_TOKEN_KEY(gateToken));
        await multi.exec();
    }
    async releaseOrderLock(ticketId) {
        const ticketKey = TICKET_KEY(ticketId);
        const ticket = await this.redis.hgetall(ticketKey);
        if (!ticket || Object.keys(ticket).length === 0) {
            return;
        }
        if (ticket[TICKET_STATE_FIELD] !== 'ORDER_PENDING') {
            return;
        }
        const multi = this.redis.multi();
        multi.hset(ticketKey, {
            [TICKET_STATE_FIELD]: 'USED',
        });
        multi.hdel(ticketKey, TICKET_ORDER_ID_FIELD);
        await multi.exec();
    }
    async promoteTickets() {
        const eventIds = await this.redis.smembers(EVENTS_SET_KEY);
        if (!eventIds.length) {
            return;
        }
        const now = Date.now();
        for (const eventId of eventIds) {
            let availableSlots = await this.calculateAvailableSlots(eventId, now);
            if (availableSlots <= 0) {
                continue;
            }
            const candidates = await this.redis.zrange(QUEUE_KEY(eventId), 0, availableSlots - 1);
            if (!candidates.length) {
                continue;
            }
            const multi = this.redis.multi();
            for (const ticketId of candidates) {
                const gateToken = (0, node_crypto_1.randomUUID)();
                const expiresAt = now + this.gateTokenTtlMs;
                multi.zrem(QUEUE_KEY(eventId), ticketId);
                multi.hset(TICKET_KEY(ticketId), {
                    [TICKET_STATE_FIELD]: 'READY',
                    [TICKET_GATE_TOKEN_FIELD]: gateToken,
                    [TICKET_EXPIRES_AT_FIELD]: expiresAt.toString(),
                });
                multi.sadd(READY_SET_KEY(eventId), ticketId);
                multi.set(GATE_TOKEN_KEY(gateToken), ticketId, 'PX', this.gateTokenTtlMs);
                availableSlots -= 1;
                if (availableSlots <= 0) {
                    break;
                }
            }
            await multi.exec();
        }
    }
    async calculateAvailableSlots(eventId, now) {
        const readyKey = READY_SET_KEY(eventId);
        const readyTickets = await this.redis.smembers(readyKey);
        if (readyTickets.length) {
            for (const ticketId of readyTickets) {
                const ticket = await this.redis.hgetall(TICKET_KEY(ticketId));
                if (!ticket || Object.keys(ticket).length === 0) {
                    await this.redis.srem(readyKey, ticketId);
                    continue;
                }
                if (ticket[TICKET_STATE_FIELD] !== 'READY') {
                    await this.redis.srem(readyKey, ticketId);
                    continue;
                }
                const expiresAt = Number(ticket[TICKET_EXPIRES_AT_FIELD] ?? 0);
                if (expiresAt && expiresAt <= now) {
                    await this.expireTicket(ticketId, ticket);
                    await this.redis.srem(readyKey, ticketId);
                }
            }
        }
        const currentReadyCount = await this.redis.scard(readyKey);
        const available = this.readyCapacity - currentReadyCount;
        return available > 0 ? available : 0;
    }
    async refreshExpiration(ticketId, ticket) {
        const state = ticket[TICKET_STATE_FIELD];
        if (state === 'READY') {
            const expiresAt = Number(ticket[TICKET_EXPIRES_AT_FIELD] ?? 0);
            if (expiresAt && expiresAt <= Date.now()) {
                await this.expireTicket(ticketId, ticket);
            }
            return;
        }
        if (state === 'USED' || state === 'ORDER_PENDING') {
            const gateToken = ticket[TICKET_GATE_TOKEN_FIELD];
            if (!gateToken) {
                return;
            }
            const ttl = await this.redis.pttl(GATE_TOKEN_KEY(gateToken));
            if (ttl < 0) {
                await this.expireTicket(ticketId, ticket);
            }
        }
    }
    async expireTicket(ticketId, ticket) {
        const ticketKey = TICKET_KEY(ticketId);
        const multi = this.redis.multi();
        multi.hset(ticketKey, {
            [TICKET_STATE_FIELD]: 'EXPIRED',
        });
        if (ticket[TICKET_GATE_TOKEN_FIELD]) {
            multi.del(GATE_TOKEN_KEY(ticket[TICKET_GATE_TOKEN_FIELD]));
        }
        if (ticket[TICKET_EVENT_FIELD]) {
            multi.srem(READY_SET_KEY(ticket[TICKET_EVENT_FIELD]), ticketId);
        }
        await multi.exec();
    }
};
exports.QueueTicketService = QueueTicketService;
exports.QueueTicketService = QueueTicketService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_provider_1.REDIS_QUEUE_CLIENT)),
    __metadata("design:paramtypes", [ioredis_1.Redis,
        config_1.ConfigService])
], QueueTicketService);
//# sourceMappingURL=queue-ticket.service.js.map