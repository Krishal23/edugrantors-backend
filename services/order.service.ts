import { NextFunction,Response } from "express";
import { CatchAsyncErrror } from "../middleware/catchAsyncError";
import OrderModel from "../models/orderModel";

//create new order
export const newOrder = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {
    const order  = await OrderModel.create(req.body);
    // next( order);
    res.status(201).json({
        success: true,
        order
    });
});
//Get All Orders
export const getAllOrderService = async (res: Response) => {
    const orders = await OrderModel.find().sort({createdAt:-1});
    res.status(201).json({
        success: true,
        orders
    });
}