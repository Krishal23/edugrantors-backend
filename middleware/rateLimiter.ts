import rateLimit from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { config } from 'dotenv';
import { getRedisClient } from '../utils/redis';
config();

// Define environment-specific rate limit configurations
const getRateLimitConfig = () => {
    const env = process.env.NODE_ENV || 'development';
    
    const configs:any = {
        development: {
            windowMs: 15 * 60 * 1000, 
            max: 500, 
            message: 'Too many requests from this IP, please try again later',
            standardHeaders: true,
            legacyHeaders: false,
            skip: (req: any) => req.url.includes('/get-courses') || req.user?.role === 'admin',
            skipFailedRequests: true
        },
        staging: {
            windowMs: 15 * 60 * 1000,
            max: 300,
            message: 'Too many requests from this IP, please try again later',
            standardHeaders: true,
            legacyHeaders: false,
            skip: (req: any) => req.url.includes('/get-courses') || req.user?.role === 'admin',
            skipFailedRequests: true
        },
        production: {
            windowMs: 15 * 60 * 1000,
            max: 250,
            message: 'Too many requests from this IP, please try again later',
            standardHeaders: true,
            legacyHeaders: false,
            skip: (req: any) => req.url.includes('/get-courses') || req.user?.role === 'admin',
            skipFailedRequests: true
        }
    };
    
    return configs[env] || configs.development;
};

// Initialize rate limiter with fallback
let rateLimiter: any;

const createRateLimiter = async () => {
    const config = getRateLimitConfig();
    
    // Use in-memory store for development or when Redis is disabled
    if (process.env.NODE_ENV === 'development' || process.env.REDIS_DISABLED === 'true') {
        console.log('Using memory store for rate limiting');
        return rateLimit(config);
    }

    try {
        const redisClient:any = await getRedisClient();
        
        if (!redisClient) {
            console.log('Redis client not available, using memory store for rate limiting');
            return rateLimit(config);
        }
        
        await redisClient.ping();
        
        // Use Redis store for rate limiting
        console.log('Using Redis store for rate limiting');
        return rateLimit({
            ...config,
            store: new RedisStore({
                sendCommand: async (command: string, ...args: string[]): Promise<RedisReply> => {
                    return redisClient.call(command, ...args) as Promise<RedisReply>;
                },
                prefix: 'rate-limiter:',
            })
        });
    } catch (error) {
        console.error('Error initializing Redis store for rate limiting:', error);
        console.log('Falling back to memory store for rate limiting');
        return rateLimit(config);
    }
};

(async () => {
    try {
        rateLimiter = await createRateLimiter();
        console.log('Rate limiter initialized successfully');
    } catch (error) {
        console.error('Failed to initialize rate limiter:', error);
        rateLimiter = rateLimit(getRateLimitConfig());
    }
})();

export const getRateLimiter = () => {
    if (!rateLimiter) {
        console.warn('Rate limiter not yet initialized, using default in-memory limiter');
        return rateLimit(getRateLimitConfig());
    }
    return rateLimiter;
};
