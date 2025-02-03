import { NextFunction, Request, Response } from "express";
import { CatchAsyncErrror } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";


//create quiz
export const createQuiz = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {
    try {
    
        res.status(201).json({
            success: true,
            
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
})