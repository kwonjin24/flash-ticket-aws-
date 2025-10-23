"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisQueueProvider = exports.REDIS_QUEUE_CLIENT = void 0;
const config_1 = require("@nestjs/config");
const ioredis_1 = require("ioredis");
exports.REDIS_QUEUE_CLIENT = Symbol('REDIS_QUEUE_CLIENT');
exports.redisQueueProvider = {
    provide: exports.REDIS_QUEUE_CLIENT,
    inject: [config_1.ConfigService],
    useFactory: (configService) => {
        const host = configService.get('REDIS_HOST') ?? 'localhost';
        const port = Number(configService.get('REDIS_PORT') ?? 6379);
        const password = configService.get('REDIS_PASSWORD') ?? undefined;
        return new ioredis_1.Redis({
            host,
            port,
            password,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        });
    },
};
//# sourceMappingURL=redis.provider.js.map