import { NextFunction, Request, Response } from "express";
import ErrorHandler from "../utils/ErrorHandler";

export const ErrorMiddlewares = (err: any, req: Request, res: Response, _next: NextFunction) => {
    err.statusCode = err.statusCode || 500;
    err.message = err.message || 'Internal Server Error';

    // Create a detailed error object for logging
    const errorDetail = {
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
        statusCode: err.statusCode,
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        requestId: req.headers['x-request-id'] || 'unknown',
        userId: req.user?._id || 'unauthenticated'
    };

    // Log error details
    console.error('Error Details:', errorDetail);

    // Handle specific error types
    if (err.name === 'CastError') {
        const message = `Resource not found. Invalid: ${err.path}`;
        err = new ErrorHandler(message, 404);
    }

    // Duplicate key errors (e.g., unique constraint violations)
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        const message = `Duplicate value for ${field}. Please use a different value.`;
        err = new ErrorHandler(message, 400);
    }

    // JWT validation errors
    if (err.name === 'JsonWebTokenError') {
        const message = 'Invalid authentication token. Please log in again.';
        err = new ErrorHandler(message, 401);
    }

    // JWT expiration errors
    if (err.name === 'TokenExpiredError') {
        const message = 'Authentication token has expired. Please log in again.';
        err = new ErrorHandler(message, 401);
    }

    // Validation errors
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map((value: any) => value.message);
        err = new ErrorHandler(message.join(', '), 400);
    }

    // Rate limiting errors
    if (err.type === 'too-many-requests') {
        err = new ErrorHandler('Rate limit exceeded. Please try again later.', 429);
    }

    // Concurrent modification errors
    if (err.name === 'VersionError') {
        err = new ErrorHandler('Resource was modified by another request. Please try again.', 409);
    }

    // MongoDB timeout errors
    if (err.name === 'MongoTimeoutError') {
        err = new ErrorHandler('Database operation timed out. Please try again.', 503);
    }

    // Redis errors
    if (err.name === 'RedisError') {
        console.error('Redis Error:', err);
        // Don't expose Redis errors to client
        err = new ErrorHandler('Internal server error', 500);
    }

    // Final error response
    res.status(err.statusCode).json({
        success: false,
        message: err.message,
        ...(process.env.NODE_ENV === 'development' && {
            stack: err.stack,
            errorDetail
        })
    });
};
