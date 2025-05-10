import rateLimit from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis'; 
import { Redis } from 'ioredis';
import { config as dotenvConfig } from 'dotenv'; 
dotenvConfig();

// Create Redis client for rate limiting
const redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
        if (times > 3) {
            return null; 
        }
        return Math.min(times * 100, 3000);
    }
});

redisClient.on('error', (err) => {
    console.error('Rate Limiter Redis Error:', err);
});

const rateLimitConfig = {
    windowMs: 15 * 60 * 1000, 
    max: 250, 
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req:any) => req.url.includes('/get-courses') || req.user?.role === 'admin', 
    skipFailedRequests: true 
};

const createRateLimiter = () => {
    if (process.env.NODE_ENV === 'development') {
        return rateLimit(rateLimitConfig);
    }

    return rateLimit({
        ...rateLimitConfig,
        store: new RedisStore({
            sendCommand: async (command: string, ...args: string[]): Promise<RedisReply> => {
                return redisClient.call(command, ...args) as Promise<RedisReply>;
            },
            prefix: 'rate-limiter:', 
        })
    });
};

export const rateLimiter = createRateLimiter();
