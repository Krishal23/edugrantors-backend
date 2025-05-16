import dotenv from "dotenv";
dotenv.config();

import express, { NextFunction, Request, Response, ErrorRequestHandler } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
// import helmet from "helmet";
// import mongoSanitize from "express-mongo-sanitize";
// import { getRateLimiter } from './middleware/rateLimiter';
import { ErrorMiddlewares } from "./middleware/error";
import { typeErrorHandler } from "./middleware/typeError";
import userRouter from "./routes/user.routes";
import courseRouter from "./routes/course.route";
import orderRouter from "./routes/order.route";
import notificationRouter from "./routes/notification.route";
import analyticsRouter from "./routes/analytics.route";
import layoutRouter from "./routes/layout.route";
import questionBankRouter from "./routes/questionBank.route";

export const app = express();

// Security headers with relaxed settings for development
// app.use(
//   helmet({
//     crossOriginResourcePolicy: { policy: "cross-origin" },
//     crossOriginOpenerPolicy: { policy: "unsafe-none" },
//   })
// );

// // Data sanitization against NoSQL query injection
// app.use(mongoSanitize());

// // Rate limiting
// // app.use('/api/', rateLimiter);
// app.use('/api/', getRateLimiter());

// Body parser with size limits
app.use(express.json({ limit: "50mb" }));
// app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Cookie parser with security options
app.use(cookieParser());

// CORS configuration
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://edugrantors.vercel.app",
      "https://edugrantors-frontend.vercel.app",
      "https://www.edugrantors.in",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "Access-Control-Allow-Headers",
      "Access-Control-Allow-Origin",
      "Access-Control-Allow-Credentials",
    ],
    exposedHeaders: ["Set-Cookie", "Date", "ETag"],
    maxAge: 86400,
  })
);

// Pre-flight requests
// app.options("*", cors());

//Routes
app.use(
  "/api/v1",
  userRouter,
  courseRouter,
  orderRouter,
  notificationRouter,
  analyticsRouter,
  layoutRouter,
  questionBankRouter
);

// Testing API
app.get("/test", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "API is working",
  });
});

// Unknown route
app.all("*", (req: Request, _res: Response, next: NextFunction) => {
  const err = new Error(`Route ${req.originalUrl} not found`) as any;
  err.statusCode = 404;
  next(err);
});

// Type Error Handler
app.use(typeErrorHandler as ErrorRequestHandler);

// General Error Handler
app.use(((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
}) as ErrorRequestHandler);

// Final Error Handler
app.use(ErrorMiddlewares);

export default app;
