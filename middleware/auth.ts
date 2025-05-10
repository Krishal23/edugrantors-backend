import dotenv from 'dotenv';
dotenv.config();

import { Request, Response, NextFunction } from "express";
import { CatchAsyncErrror } from "./catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import jwt from "jsonwebtoken";
import { redis } from "../utils/redis";
import userModel from '../models/user.model';

export interface JwtPayload {
    userId: string; // or number, depending on your user ID type
}

// Authenticated user middleware
export const isAuthenticated = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const accessToken = req.cookies.access_token;
        const refreshToken = req.cookies.refresh_token;

        if (!accessToken && !refreshToken) {
            return next(new ErrorHandler('You are not logged in!', 401));
        }

        // First try to verify access token
        try {
            const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN as string) as JwtPayload & { id: string };
            const user = await redis.get(decoded.id);

            if (!user) {
                throw new Error('User not found in cache');
            }

            req.user = JSON.parse(user);
            return next();
        } catch (accessError) {
            // Access token invalid/expired, try refresh token
            if (!refreshToken) {
                return next(new ErrorHandler('Please login to access this resource', 401));
            }

            try {
                const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN as string) as JwtPayload & { id: string };
                
                // Get user from cache or DB
                let user = await redis.get(decoded.id);
                if (!user) {
                    user = await userModel.findById(decoded.id);
                    if (!user) {
                        return next(new ErrorHandler('User not found', 404));
                    }
                    // Update cache
                    await redis.set(decoded.id, JSON.stringify(user), 'EX', 604800); // 7 days
                }

                // Generate new access token
                const newAccessToken = jwt.sign({ id: decoded.id }, process.env.ACCESS_TOKEN as string, {
                    expiresIn: '5m'
                });

                // Set new access token in cookie
                res.cookie('access_token', newAccessToken, {
                    maxAge: 300000, // 5 minutes
                    httpOnly: true,
                    sameSite: 'lax',
                    secure: process.env.NODE_ENV === 'production'
                });

                req.user = typeof user === 'string' ? JSON.parse(user) : user;
                return next();
            } catch (refreshError) {
                return next(new ErrorHandler('Please login to access this resource', 401));
            }
        }
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});

// Validate user role
export const authorizeRoles = (...roles: string[]) => {
    
    return async (req: Request, _res: Response, next: NextFunction) => {
        const user = await userModel.findById(req.user?._id).select("role");;
        if (user?.role === 'admin') {
            return next(); // Admin is always authorized
        }
        else if (!roles.includes(user?.role || '')) {
            return next(new ErrorHandler(`Role ${user?.role} is not authorized`, 403));
        }
        return next(); 
    }
}
