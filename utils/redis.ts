import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();  // Load environment variables from .env file

// Function to create Redis client
const createRedisClient = () => {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
        throw new Error('Redis Connection Failed: REDIS_URL is not defined in environment variables.');
    }

    return redisUrl;  // Return the Redis URL if it's available in environment variables
};

// Create Redis instance
export const redis = new Redis(createRedisClient(), {
    connectTimeout: 10000,  // Set a connect timeout of 10 seconds
    maxRetriesPerRequest: 50,
    retryStrategy: (times) => Math.min(times * 100, 2000),  // Exponential backoff for retries
    keepAlive: 10000,  // Keep the connection alive for 10 seconds
});

// Log when Redis is connected successfully
redis.on('connect', () => {
    console.log('Redis connected successfully');
});

// Handle Redis errors
redis.on('error', (err) => {
    console.error('Redis error:', err);
});

// Optionally, you can log when the Redis client is ready to accept commands
redis.on('ready', () => {
    console.log('Redis client is ready to use');
});

// Optionally, you can handle the 'end' event to log when the connection is closed
redis.on('end', () => {
    console.log('Redis connection closed');
});
