import { NextFunction, Request, Response } from "express";
import { CatchAsyncErrror } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import OrderModel, { IOrder } from "../models/orderModel";
import userModel from "../models/user.model";
import CourseModel from "../models/course.models";
import path from "path";
import ejs from "ejs";
import sendMail from "../utils/sendMail";
import NotificationModel from "../models/notificationModel";
import { getAllOrderService, newOrder } from "../services/order.service";
import Razorpay from "razorpay"
import { redis } from "../utils/redis";
import orderRouter from "../routes/order.route";
import crypto from "crypto";






// Initialize Razorpay instance
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export const hello = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {
    res.status(201).json({
        success: true,

    });

});

// Create Razorpay Order API
export const createRazorpayOrder = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {

    const { amount, currency = "INR", receipt, notes } = req.body;
    try {
        if (!amount) {
            return next(new ErrorHandler("Amount is required", 400));
        }

        // Create an order on Razorpay
        const order = await razorpay.orders.create({
            amount: amount * 100, // Amount in paise (1 INR = 100 paise)
            currency,
            receipt: receipt || `receipt_${Date.now()}`,
            notes: notes || { key1: "value1" },
            payment_capture: true, // Auto-capture the payment
        });

        // Respond with the order details
        res.status(201).json({
            success: true,
            order,
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message || "Failed to create Razorpay order", 500));
    }
});



export const verifyPayment = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return next(new ErrorHandler("Invalid payment details", 400));
    }

    try {
        // Verify signature
        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        if (generatedSignature !== razorpay_signature) {
            return next(new ErrorHandler("Payment verification failed", 400));
        }
        res.status(200).json({
            success: true,
            message: "Payment verified successfully",
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message || "Failed to verify payment", 500));
    }
});



export const createOrder = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { courseId,courseName, payment_info, couponCode } = req.body as IOrder;
        const userId = req.user?._id;
        const user = await userModel.findById(userId);
        if (!user) {
            return next(new ErrorHandler("User not found", 404));
        }

        const courseExistInUser = user.courses.some((course: any) =>
            course._id.toString() === courseId.toString()
        );


        if (courseExistInUser) {
            return next(new ErrorHandler("You have already purchased this course", 400));
        }

        // Find the course in the database
        const course: any = await CourseModel.findById(courseId);
        if (!course) {
            return next(new ErrorHandler("Course not found", 404));
        }

        // Create the new order
        const orderData: any = {
            courseId: course._id,
            userId: user._id,
            payment_info
        };

        await OrderModel.create(orderData);

        if (couponCode) {
            const coupon = course.coupons.find(
                (coupon: any) =>
                    coupon.couponId === couponCode &&
                    // coupon.courseId === courseId &&
                    coupon.isActive &&
                    coupon.validity > new Date() &&
                    coupon.count < coupon.maxAllowed
            );

            if (!coupon) {
                return next(new ErrorHandler("Invalid or expired coupon code", 400));
            }

            // Update coupon usage
            coupon.count += 1;
            coupon.beneficiary.push(userId);
        }
        // Increment the course's purchase count
        course.purchased = (course.purchased || 0) + 1;
        course.studentsEnrolled.push(user._id);
        await course.save();

        // // Prepare email data for order confirmation
        const mailData = {
            order: {
                _id: course._id.toString().slice(0, 6),
                name: course.name,
                price: course.price,
                date: new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                }),
            },
        };

        // // Send confirmation email to the user
        try {
            await sendMail({
                email: user.email,
                subject: 'Order Confirmation',
                template: "order-confirmation.ejs",
                data: mailData,
            });
        } catch (emailError) {
            return next(new ErrorHandler("Failed to send order confirmation email", 500));
        }

        user.courses.push({
            courseId: course._id,
            courseName: courseName,
          });
          
        await redis.set(req.user?._id as string, JSON.stringify(user));
        await user.save();



        // Create a notification for the new order
        await NotificationModel.create({
            userId: user._id,
            title: "New Order",
            message: `You have a new order for ${course.name}`,
        });

        // Final response with payment details
        res.status(201).json({
            success: true,
            message: "Order created successfully",
        });

    } catch (error: any) {
        return next(new ErrorHandler(error.message || "Internal Server Error", 500));
    }
});






























export const newPayment = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID!,
            key_secret: process.env.RAZORPAY_KEY_SECRET!,
        })

        const myPayment = await razorpay.orders.create({
            amount: req.body.amount,
            currency: "INR",
            receipt: "receipt#1",
            payment_capture: true,
            notes: {
                key1: "value3",
                key2: "value2"
            }
        })
        try {
            res.json({
                order_id: myPayment.id,
                currency: myPayment.currency,
                amount: myPayment.amount
            })
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 500));
        }
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
})

export const fetchPaymentID = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {

    const { paymentId } = req.params;
    const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID!,
        key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })
    try {
        const payment = await razorpay.payments.fetch(paymentId);
        if (!payment) {
            return res.status(500).json("Error at razrpay loading")
        }
        res.json({
            status: payment.status,
            method: payment.method,
            amount: payment.amount,
            currency: payment.currency
        })
    } catch (err) {
        return res.status(500).json("Error at razrpay loading")
    }

})


export const createOrder2 = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { courseId } = req.body as IOrder;
        const userId = req.user?._id;
        const user = await userModel.findById(userId);
        if (!user) {
            return next(new ErrorHandler("User not found", 404));
        }

        // Check if the course already exists in the user's purchased courses
        const courseExistInUser = user.courses.some((course: any) =>
            course._id.toString() === courseId.toString()
        );


        if (courseExistInUser) {
            return next(new ErrorHandler("You have already purchased this course", 400));
        }

        // Find the course in the database
        const course: any = await CourseModel.findById(courseId);
        if (!course) {
            return next(new ErrorHandler("Course not found", 404));
        }

        // Create the new order
        const orderData: any = {
            courseId: course._id,
            userId: user._id,
        };

        //  newOrder(orderData, res,next);
        const order = await OrderModel.create(orderData);
        // Increment the course's purchase count
        course.purchased = (course.purchased || 0) + 1;
        course.studentsEnrolled.push(user._id);
        await course.save();

        // // Prepare email data for order confirmation
        const mailData = {
            order: {
                _id: course._id.toString().slice(0, 6),
                name: course.name,
                price: course.price,
                date: new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                }),
            },
        };

        // // Send confirmation email to the user
        try {
            await sendMail({
                email: user.email,
                subject: 'Order Confirmation',
                template: "order-confirmation.ejs",
                data: mailData,
            });
        } catch (emailError) {
            return next(new ErrorHandler("Failed to send order confirmation email", 500));
        }

        // Update the user's purchased courses
        user.courses.push(course._id);
        await redis.set(req.user?._id as string, JSON.stringify(user));
        await user.save();


        // Create a notification for the new order
        await NotificationModel.create({
            userId: user._id,
            title: "New Order",
            message: `You have a new order for ${course.name}`,
        });

        // Final response with payment details
        res.status(201).json({
            success: true,
            message: "Order created successfully",
        });

    } catch (error: any) {
        return next(new ErrorHandler(error.message || "Internal Server Error", 500));
    }
});


//get all orders --only for admin
export const getAllOrders = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {
    try {
        getAllOrderService(res)
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});


// sent stripe publishble key
export const sendRazorpayPublishableKey = CatchAsyncErrror(async (req: Request, res: Response) => {
    res.status(200).json({
        key_id: process.env.RAZORPAY_KEY_ID!,
    })
})
