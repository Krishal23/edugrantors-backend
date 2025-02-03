import { Request, Response, NextFunction } from "express";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncErrror } from "../middleware/catchAsyncError";
import { generateLast12MonthData } from "../utils/analytics.generator";
import userModel from "../models/user.model";
import CourseModel from "../models/course.models";
import OrderModel from "../models/orderModel";

//get users analytics --only for admins
export const getUserAnalytics = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await generateLast12MonthData(userModel);
        res.status(200).json({
            success: true,
            data: user
        });
    } catch (err: any) {
        next(new ErrorHandler(err.message, 400));
    }

});

//get courses analytics --only for admins
export const getCoursesAnalytics = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const courses = await generateLast12MonthData(CourseModel);
        res.status(200).json({
            success: true,
            data: courses
        });
    } catch (err: any) {
        next(new ErrorHandler(err.message, 400));
    }

});
//get orders analytics --only for admins
export const getOrderAnalytics = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orders = await generateLast12MonthData(OrderModel);
        res.status(200).json({
            success: true,
            data: orders
        });
    } catch (err: any) {
        next(new ErrorHandler(err.message, 400));
    }

});

