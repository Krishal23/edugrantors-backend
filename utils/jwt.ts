require('dotenv').config();
import { Response } from 'express';
import { IUser } from '../models/user.model';
import { redis } from './redis';

interface ITokenOptions {
    expires: Date;
    maxAge: number;
    httpOnly: boolean;
    sameSite: 'lax' | 'strict' | 'none' | undefined;
    secure?: boolean;
    path?: string;
}

// Parse token expiry from environment or use default values
export const accessTokenExpire = parseInt(process.env.ACCESS_TOKEN_EXPIRE || '5'); // Default: 300 seconds (5 mins)
export const refreshTokenExpire = parseInt(process.env.REFRESH_TOKEN_EXPIRE || '5'); // Default: 604800 seconds (1 week)

// Cookie options for access token
export const accessTokenOptions: ITokenOptions = {
    expires: new Date(Date.now() + accessTokenExpire * 60 * 60 * 1000),
    maxAge: accessTokenExpire *  60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
};

// Cookie options for refresh token
export const refreshTokenOptions: ITokenOptions = {
    expires: new Date(Date.now() + refreshTokenExpire * 24 * 60 * 60 * 1000),
    maxAge: refreshTokenExpire * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
};

export const sendToken = async (user: IUser, statusCode: number, res: Response) => {
    try {
        const accessToken = user.SignAccessToken();
        const refreshToken = user.SignRefreshToken();

        await redis.set(user.id.toString(), JSON.stringify(user), 'EX', parseInt(process.env.REDIS_SESSION_EXPIRE || '86400'));


        // Add secure flag in production for HTTPS
        if (process.env.NODE_ENV === 'production') {
            accessTokenOptions.secure = true;
            refreshTokenOptions.secure = true;
            accessTokenOptions.sameSite = 'none';
            refreshTokenOptions.sameSite = 'none';
        }

        // Set cookies for access and refresh tokens
        res.cookie('access_token', accessToken, accessTokenOptions);
        res.cookie('refresh_token', refreshToken, refreshTokenOptions);

        // Send success response
        res.status(statusCode).json({
            success: true,
            user,
            accessToken,
        });
    } catch (error: any) {
        console.error('Error while generating tokens:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while generating tokens.',
            error: error.message || error,
        });
    }
};
