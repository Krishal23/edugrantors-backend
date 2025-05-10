import Queue from 'bull';

// Queue configuration
const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: 5,
    enableReadyCheck: false,
    retryStrategy: (times: number) => {
        const delay = Math.min(Math.exp(times) * 100, 20000);
        return delay;
    }
};

const createQueue = (name: string) => {
    if (process.env.NODE_ENV === 'development' && process.env.REDIS_DISABLED === 'true') {
        return {
            add: async () => Promise.resolve(),
            process: () => {},
            on: () => {},
            pause: async () => Promise.resolve(),
            close: async () => Promise.resolve()
        };
    }

    const queue = new Queue(name, {
        redis: redisConfig,
        settings: {
            retryProcessDelay: 5000,
            lockDuration: 30000,
            stalledInterval: 30000,
            maxStalledCount: 3
        }
    });

    // Queue event handlers
    queue.on('error', (error) => {
        console.error(`${name} queue error:`, error);
    });

    queue.on('failed', (job, error) => {
        console.error(`${name} job ${job.id} failed:`, error);
    });

    queue.on('stalled', (job) => {
        console.warn(`${name} job ${job.id} stalled`);
    });

    // Graceful shutdown handler
    const shutdown = async () => {
        try {
            await queue.pause(true);
            await queue.close();
            console.log(`${name} queue closed`);
        } catch (error) {
            console.error(`Error closing ${name} queue:`, error);
        }
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    return queue;
};

// Create queues with improved error handling
export const emailQueue = createQueue('email');
export const imageQueue = createQueue('image');
export const analyticsQueue = createQueue('analytics');

// Configure job processors
emailQueue.process(async (job) => {
    try {
        // Email processing logic
        return job.data;
    } catch (error) {
        console.error('Email processing error:', error);
        throw error;
    }
});

imageQueue.process(async (job) => {
    try {
        // Image processing logic
        return job.data;
    } catch (error) {
        console.error('Image processing error:', error);
        throw error;
    }
});

analyticsQueue.process(async (job) => {
    try {
        // Analytics processing logic
        return job.data;
    } catch (error) {
        console.error('Analytics processing error:', error);
        throw error;
    }
});