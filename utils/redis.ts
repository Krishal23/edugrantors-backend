import { Redis } from 'ioredis';
import { config } from 'dotenv';
import { memoryCache } from './memoryCache';
config();

let redisClient: Redis | null = null;

const createRedisClient = () => {
    if (redisClient) return redisClient;

    if (process.env.NODE_ENV === 'development' && process.env.REDIS_DISABLED === 'true') {
        console.log('Redis disabled in development, using memory cache');
        return null;
    }

    const client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        retryStrategy: (times: number) => Math.min(Math.exp(times) * 100, 20000),
        maxRetriesPerRequest: null,
        enableOfflineQueue: true,
        connectTimeout: 10000,
        reconnectOnError: (err) => err.message.includes('READONLY'),
        lazyConnect: false,
    });

    
    client.on('error', (err) => {
        console.error('Redis Client Error:', err);
    });

    client.on('connect', () => {
        const { host, port } = client.options;
        console.log(`✅ Redis Client Connected to ${host}:${port}`);
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
            if (cache === memoryCache) {
                return (cache as typeof memoryCache).get(key) ?? null;
            }
            const result = await (cache as Redis).get(key);
            return result === null ? null : result;
        } catch (error) {
            console.error(`Cache GET Error for key ${key}:`, error);
            return null;
        }
    },

    // set: async (key: string, value: string, expireFlag?: string, expireValue?: number): Promise<boolean> => {
    //     try {
    //         const cache = await getCache();
    //         if (cache === memoryCache) {
    //             (cache as typeof memoryCache).set(key, value);
    //             if (expireFlag && expireValue) {
    //                 // Implement expiry in memoryCache if needed
    //                 console.warn('Expiry not implemented for memoryCache');
    //             }
    //             return true;
    //         }
    //         if (expireFlag && expireValue) {
    //             await (cache as Redis).set(key, value, expireFlag, expireValue);
    //         } else {
    //             await (cache as Redis).set(key, value);
    //         }
    //         return true;
    //     } catch (error) {
    //         console.error(`Cache SET Error for key ${key}:`, error);
    //         return false;
    //     }
    // },

    set: async (key: string, value: string, expireFlag?: string, expireValue?: number): Promise<boolean> => {
        try {
            const cache = await getCache();
            if (cache === memoryCache) {
                (cache as typeof memoryCache).set(key, value);
                if (expireFlag && expireValue) {
                    console.warn('Expiry not implemented for memoryCache');
                }
                return true;
            }

            if (expireFlag === "EX" && expireValue) {
                // Set with expiration in seconds
                await (cache as Redis).set(key, value, "EX", expireValue);
            } else if (expireFlag === "PX" && expireValue) {
                // Set with expiration in milliseconds
                await (cache as Redis).set(key, value, "PX", expireValue);
            } else if (expireFlag === "KEEPTTL") {
                // Keep existing TTL (Redis 6.0+)
                await (cache as Redis).set(key, value, "KEEPTTL");
            } else {
                // Default set without expiration
                await (cache as Redis).set(key, value);
            }
            return true;
        } catch (error) {
            console.error(`Cache SET Error for key ${key}:`, error);
            return false;
        }
    }
    ,


    del: async (key: string): Promise<boolean> => {
        try {
            const cache = await getCache();
            if (cache === memoryCache) {
                (cache as typeof memoryCache).del(key);
                return true;
            }
            const result = await (cache as Redis).del(key);
            return result > 0;
        } catch (error) {
            console.error(`Cache DEL Error for key ${key}:`, error);
            return false;
        }
    },

    mget: async (keys: string[]): Promise<(string | null)[]> => {
        try {
            const cache = await getCache();
            if (cache === memoryCache) {
                const promises = keys.map(async (key) => {
                    const value = await (cache as typeof memoryCache).get(key);
                    return value ?? null;
                });
                return await Promise.all(promises);
            }
            const result = await (cache as Redis).mget(keys);
            return result.map(item => item === null ? null : item);
        } catch (error) {
            console.error('Cache MGET Error:', error);
            return new Array(keys.length).fill(null);
        }
    },


    mset: async (keyValuePairs: { [key: string]: string }): Promise<boolean> => {
        try {
            const cache = await getCache();
            if (cache === memoryCache) {
                for (const [key, value] of Object.entries(keyValuePairs)) {
                    (cache as typeof memoryCache).set(key, value);
                }
                return true;
            }

            await (cache as Redis).mset(keyValuePairs);
            return true;
        } catch (error) {
            console.error('Cache MSET Error:', error);
            return false;
        }
    },

    invalidatePattern: async (pattern: string): Promise<boolean> => {
        try {
            const cache = await getCache();
            if (cache === memoryCache) {
                console.warn('invalidatePattern not implemented for memoryCache');
                return false;
            }
            const keys = await (cache as Redis).keys(pattern);
            if (keys.length === 0) {
                return true;
            }
            await (cache as Redis).del(keys);
            return true;
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
