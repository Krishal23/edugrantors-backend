import { app } from "./app";
import { config } from "dotenv";
import connectDB from "./utils/db";
import { createServer } from 'http';
import { initializeWebSocket } from './utils/websocket';
import { v4 as uuidv4 } from 'uuid';
import morgan from 'morgan';
import cluster from 'cluster';
import os from 'os';
import { getRedisClient } from './utils/redis';

declare module 'express-serve-static-core' {
  interface Request {
    id?: string;
  }
}

config();

// Request ID middleware
app.use((req, res, next) => {
    req.id = uuidv4();
    res.on('finish', () => {
        console.log(`[${new Date().toISOString()}] ${req.id} ${req.method} ${req.url} ${res.statusCode}`);
    });
    next();
});

// Development logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Create HTTP server
const httpServer = createServer(app);

// Initialize WebSocket
initializeWebSocket(httpServer);

// Health check function
const checkServices = async () => {
    try {
        // Check Redis connection
        const redisClient = await getRedisClient();
        if (!redisClient) {
            throw new Error('Redis connection failed');
        }
        // await redisClient.ping();
        
        // Check MongoDB connection
        await connectDB();
        
        return true;
    } catch (error) {
        console.error('Service health check failed:', error);
        return false;
    }
};

// Startup function
const startServer = async () => {
    try {
        // Check all required services
        const servicesHealthy = await checkServices();
        if (!servicesHealthy) {
            console.error('Critical services unavailable, cannot start server');
            process.exit(1);
        }

        const PORT = process.env.PORT || 5000;
        httpServer.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Multi-process handling for production
if (cluster.isPrimary && process.env.NODE_ENV === 'production') {
    const numCPUs = os.cpus().length;
    
    console.log(`Master process running on PID ${process.pid}`);
    
    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died (${signal || code})`);
        if (code !== 0 && !worker.exitedAfterDisconnect) {
            console.log('Starting a new worker...');
            cluster.fork();
        }
    });

    // Periodic health checks
    setInterval(async () => {
        const healthy = await checkServices();
        if (!healthy) {
            console.error('Health check failed, attempting service recovery...');
        }
    }, 30000); // Check every 30 seconds

} else {
    // Worker process or development mode
    startServer().catch(error => {
        console.error('Server startup failed:', error);
        process.exit(1);
    });
}

// Enhanced error handling
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Attempt graceful shutdown
    httpServer.close(() => {
        console.log('Server closed due to uncaught exception');
        process.exit(1);
    });
    // Force shutdown if graceful shutdown fails
    setTimeout(() => {
        console.error('Forced shutdown due to uncaught exception');
        process.exit(1);
    }, 10000);
});

process.on('unhandledRejection', (err: any) => {
    console.error('Unhandled Rejection:', err);
    // Attempt graceful shutdown
    httpServer.close(() => {
        console.log('Server closed due to unhandled rejection');
        process.exit(1);
    });
    // Force shutdown if graceful shutdown fails
    setTimeout(() => {
        console.error('Forced shutdown due to unhandled rejection');
        process.exit(1);
    }, 10000);
});