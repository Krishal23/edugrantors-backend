import express from "express";
import { authorizeRoles, isAuthenticated } from "../middleware/auth";
import { createOrder, createRazorpayOrder, fetchPaymentID, getAllOrders, verifyPayment } from "../controllers/order.controller";
import { updateAccessToken } from "../controllers/user.controller";
import Razorpay from "razorpay";


const orderRouter = express.Router();

orderRouter.post(
    "/create-order",
    updateAccessToken,
    isAuthenticated,
    createOrder
);
orderRouter.post(
    "/razorpay/create-order", 
    updateAccessToken,
    isAuthenticated,
    createRazorpayOrder
);
orderRouter.post(
    "/razorpay/verify-payment",
    updateAccessToken,
    isAuthenticated, 
    verifyPayment
)


orderRouter.get(
    "/get-orders",
    updateAccessToken,
    isAuthenticated,
    authorizeRoles("teacher"),
    getAllOrders
);

orderRouter.get(
    "/payment/:paymentId",
    fetchPaymentID
)
orderRouter.post(
    "/payment",
    createOrder
)

export default orderRouter;
