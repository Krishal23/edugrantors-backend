import NotificationModel from "../models/notificationModel";
import { Request, Response, NextFunction } from "express";
import { CatchAsyncErrror } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import cron from "node-cron";

//get notifications --only for admin
export const getNotification = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const notifications = await NotificationModel.find().sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: notifications
        });

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

//update notification status
export const updateNotificationStatus = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const notification = await NotificationModel.findById(req.params.id);
        if (!notification) {
            return next(new ErrorHandler('Notification not found', 404));
        }
        notification.status = 'read';
        await notification.save();
        const notifications = await NotificationModel.find().sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            notifications
        });

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

//delete notification --only for admin
cron.schedule("0 0 0 * * *", async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await NotificationModel.deleteMany({
        status:"read",
        createdAt: {$lt:  thirtyDaysAgo},
    });
    console.log("Deleted last 30 days notifications");
})