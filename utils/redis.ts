import { Redis } from 'ioredis';
import { config } from 'dotenv';
import { memoryCache } from './memoryCache';
config();

let redisClient: Redis | null = null;

const createRedisClient = () => {
    // Don't create Redis client in development if REDIS_DISABLED is true
    if (process.env.NODE_ENV === 'development' && process.env.REDIS_DISABLED === 'true') {
        console.log('Redis disabled in development, using memory cache');
        return null;
    }

    const client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        retryStrategy: (times: number) => {
            const delay = Math.min(Math.exp(times) * 100, 20000);
            console.log(`Retrying Redis connection in ${delay}ms... (attempt ${times})`);
            return delay;
        },
        maxRetriesPerRequest: 5,
        enableOfflineQueue: true,
        reconnectOnError: (err) => {
            const targetError = 'READONLY';
            return err.message.includes(targetError);
        },
        lazyConnect: false // Changed to false to connect immediately
    });

    client.on('error', (err) => {
        console.error('Redis Client Error:', err);
    });

    client.on('connect', () => {
        console.log('Redis Client Connected');
    });

    client.on('ready', () => {
        console.log('Redis Client Ready');
    });

    client.on('reconnecting', () => {
        console.log('Redis Client Reconnecting...');
    });

    client.on('end', () => {
        console.log('Redis Client Connection Ended');
    });

    return client;
};

const getCache = async () => {
    if (process.env.NODE_ENV === 'development' && process.env.REDIS_DISABLED === 'true') {
        return memoryCache;
    }

    if (!redisClient) {
        redisClient = createRedisClient();
    }

    if (redisClient) {
        try {
            // Test connection with ping
            await redisClient.ping();
        } catch (error) {
            console.error('Failed to establish Redis connection:', error);
            redisClient = null;
            if (process.env.NODE_ENV === 'development') {
                console.log('Falling back to memory cache');
                return memoryCache;
            }
        }
    }
    return redisClient || memoryCache;
};

export const redis = {
    ping: async (): Promise<boolean> => {
        try {
            const cache = await getCache();
            if (cache === memoryCache) return true;
            await (cache as Redis).ping();
            return true;
        } catch (error) {
            console.error('Redis ping failed:', error);
            return false;
        }
    },

    get: async (key: string): Promise<string | null> => {
        try {
            const cache = await getCache();
            return await cache.get(key);
        } catch (error) {
            console.error(`Cache GET Error for key ${key}:`, error);
            return null;
        }
    },

    set: async (key: string, value: string, expireFlag?: string, expireValue?: number): Promise<boolean> => {
        try {
            const cache = await getCache();
            return await cache.set(key, value, expireFlag, expireValue);
        } catch (error) {
            console.error(`Cache SET Error for key ${key}:`, error);
            return false;
        }
    },

    del: async (key: string): Promise<boolean> => {
        try {
            const cache = await getCache();
            return await cache.del(key);
        } catch (error) {
            console.error(`Cache DEL Error for key ${key}:`, error);
            return false;
        }
    },

    mget: async (keys: string[]): Promise<(string | null)[]> => {
        try {
            const cache = await getCache();
            return await cache.mget(keys);
        } catch (error) {
            console.error('Cache MGET Error:', error);
            return new Array(keys.length).fill(null);
        }
    },

    mset: async (keyValuePairs: { [key: string]: string }): Promise<boolean> => {
        try {
            const cache = await getCache();
            return await cache.mset(keyValuePairs);
        } catch (error) {
            console.error('Cache MSET Error:', error);
            return false;
        }
    },

    invalidatePattern: async (pattern: string): Promise<boolean> => {
        try {
            const cache = await getCache();
            return await cache.invalidatePattern(pattern);
        } catch (error) {
            console.error(`Cache Pattern Invalidation Error for ${pattern}:`, error);
            return false;
        }
    }
};

export const getRedisClient = async () => {
    const cache = await getCache();
    return cache === memoryCache ? null : cache;
};

// Graceful shutdown handler
const closeRedisConnection = async () => {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
    }
};

process.on('SIGTERM', closeRedisConnection);
process.on('SIGINT', closeRedisConnection);
