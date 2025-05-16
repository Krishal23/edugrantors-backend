// // import { getRedisClient } from './redis';

// export class DistributedLock {
//     private lockKey: string;
//     // private ttl: number;

//     constructor(resourceId: string, ttlSeconds: number = 30) {
//         this.lockKey = `lock:${resourceId}`;
//         this.ttl = ttlSeconds;
//     }

//     // async acquire(): Promise<boolean> {
//     //     const redis = await getRedisClient(); 
//     //     if (!redis) return false;

//     //     // NX = Only set if key doesn't exist; EX = Set expiry in seconds
//     //     const result = await redis.set(this.lockKey, '1', 'EX', this.ttl);
        
//     //     return result === 'OK';
//     // }

//     async release(): Promise<void> {
//         const redis = await getRedisClient(); 
//         if (!redis) return;

//         await redis.del(this.lockKey);
//     }

//     static async withLock<T>(
//         resourceId: string,
//         callback: () => Promise<T>,
//         ttlSeconds: number = 30
//     ): Promise<T> {
//         const lock = new DistributedLock(resourceId, ttlSeconds);

//         if (!await lock.acquire()) {
//             throw new Error('Failed to acquire lock. Resource is busy.');
//         }

//         try {
//             return await callback();
//         } finally {
//             await lock.release();
//         }
//     }
// }