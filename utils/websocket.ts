import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { redis } from './redis';

export function initializeWebSocket(httpServer: HttpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: [
                "http://localhost:3000",
                "https://edugrantors.vercel.app",
                "https://edugrantors-frontend.vercel.app",
                "https://www.edugrantors.in"
            ],
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    // Track active users
    const activeUsers = new Map();

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        // Handle user joining
        socket.on('join', async (userId: string) => {
            activeUsers.set(socket.id, userId);
            socket.join(userId);
            
            // Subscribe to user's notification channel
            // const notificationChannel = `notifications:${userId}`;
            await redis.set(`socket:${userId}`, socket.id, 'EX', 3600); // 1 hour expiry
        });

        // Handle real-time quiz updates
        socket.on('quiz:attempt', async (data) => {
            const { courseId, quizId, userId } = data;
            const roomId = `quiz:${courseId}:${quizId}`;
            socket.join(roomId);
            
            // Notify course teacher
            const courseRoom = `course:${courseId}`;
            io.to(courseRoom).emit('quiz:newAttempt', {
                userId,
                quizId
            });
        });

        // Handle course updates
        socket.on('course:update', async (data) => {
            const { courseId } = data;
            const roomId = `course:${courseId}`;
            io.to(roomId).emit('course:changed', data);
        });

        // Handle disconnection
        socket.on('disconnect', async () => {
            const userId = activeUsers.get(socket.id);
            if (userId) {
                await redis.del(`socket:${userId}`);
                activeUsers.delete(socket.id);
            }
        });
    });

    return io;
}