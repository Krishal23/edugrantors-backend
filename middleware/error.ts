import { NextFunction,Request,Response } from "express";
import ErrorHandler from "../utils/ErrorHandler";

export const ErrorMiddlewares= (err: any, req: Request, res: Response, next: NextFunction) => {
    err.statusCode = err.statusCode || 500;
    err.message = err.message || 'Something went wrong';

    //wrong mongodb id error
    if (err.name === 'CastError') {
        const message = `Resource  not found. Invalid:${err.path}`
        err = new ErrorHandler(message, 404);
    }
    //duplicate fields error
    if (err.code === 11000) {
        const message = `Duplicate:${err.path}`
        err = new ErrorHandler(message, 400);
    }

    //wrong jwt error
    if (err.name === 'JsonWebTokenError') {
        const message = 'Your token is invalid. Please log in again'
        err = new ErrorHandler(message, 400);
    }

    //JWT expired errror
    if (err.name === 'TokenExpiredError') {
        const message = 'Your token has expired. Please log in again'
        err = new ErrorHandler(message, 400);
    }

    res.status(err.statusCode).json({
        success: false,
        message: err.message
    })


}
