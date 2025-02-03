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
    const accessToken = req.cookies.access_token;
    const refreshToken = req.cookies.refresh_token;

    if (!accessToken && !refreshToken) {
        return next(new ErrorHandler('You are not logged in!', 400));
    }

    try {
        // Verify the access token
        const decoded: any = jwt.verify(accessToken, process.env.ACCESS_TOKEN as string) as JwtPayload;
        // Now use decoded.id instead of decoded.userId
        const userId = decoded.id; // Changed from userId to id
        const user = await redis.get(userId);

        if (!user) {
            return next(new ErrorHandler('Please Login to bn,m access this course', 400));
        }

        req.user = JSON.parse(user);
        return next(); // End execution here if successful
    } catch (err) {
        if (refreshToken) {
            try {
                // Verify the refresh token
                const decodedRefreshToken = jwt.verify(refreshToken, process.env.REFRESH_TOKEN as string) as JwtPayload;
                const user = await redis.get(decodedRefreshToken.userId);

                if (!user) {
                    return next(new ErrorHandler('User not found', 400));
                }

                // If refresh token is valid, issue a new access token
                const newAccessToken = jwt.sign({ userId: decodedRefreshToken.userId }, process.env.ACCESS_TOKEN as string, { expiresIn: '15m' });

                // Set the new access token in cookies
                res.cookie('access_token', newAccessToken, { httpOnly: true }); // Consider secure settings based on your environment

                req.user = JSON.parse(user);
                return next(); // End execution here if successful
            } catch (refreshError) {
                return next(new ErrorHandler('Refresh token is invalid or expired', 401));
            }
        } else {
            return next(new ErrorHandler('Token is invalid or expired', 401));
        }
    }
});

// Validate user role
export const authorizeRoles = (...roles: string[]) => {
    
    return async (req: Request, res: Response, next: NextFunction) => {
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
