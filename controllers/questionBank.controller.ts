import { CatchAsyncErrror } from "../middleware/catchAsyncError";
import { NextFunction, Request, Response } from "express";
import ErrorHandler from "../utils/ErrorHandler";
import QuestionBank from "../models/questionBank.model";
import CourseModel from "../models/course.models";
import cloudinary from "cloudinary";



export const uploadQuestion = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = req.body;
        // console.log(data)

        
        if (!data.courseId) {
            return next(new ErrorHandler("courseId is required.", 400));
        }
        const courseExists = await CourseModel.findById(data.courseId);
        if (!courseExists) {
            return next(new ErrorHandler("Invalid courseId. Course does not exist.", 404));
        }
        const userId = req.user?._id;
        data.createdBy = userId;

        const image = data.image;
        if (image) {
            const myCloud = await cloudinary.v2.uploader.upload(image, {
                folder: "questions",
            });
            data.image = {
                public_id: myCloud.public_id,
                url: myCloud.secure_url,
            }
        }
        const imageExplain = data.imageExplain;
        if (imageExplain) {
            const myCloud = await cloudinary.v2.uploader.upload(imageExplain, {
                folder: "questionsExplanation",
            });
            data.imageExplain = {
                public_id: myCloud.public_id,
                url: myCloud.secure_url,
            }
        }


        if (data.type === "single" || data.type === "multiple") {
            if (!data.options || !Array.isArray(data.options)) {
                return next(new ErrorHandler("Options are required for SCQ and MCQ types.", 400));
            }
        }
        const question = await QuestionBank.create(data);
        // console.log(question)

        res.status(201).json({
            success: true,
            message: "Question uploaded successfullyy.",
            question,
            data,
            image,
            imageExplain
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});

export const editQuestion = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { questionId, ...data } = req.body;  // Destructure to get questionId and data
        const questionData = await QuestionBank.findById(questionId);
        if (!questionData) {
            return next(new ErrorHandler("Question not found", 404));
        }

        // Validate updates for SCQ or MCQ
        if (data.type === "SCQ" || data.type === "MCQ") {
            if (data.options && !Array.isArray(data.options)) {
                return next(new ErrorHandler("Options must be an array for SCQ and MCQ types.", 400));
            }
        }

        const updatedQuestion = await QuestionBank.findByIdAndUpdate(
            questionId,
            { $set: data },
            { new: true },
        );

        if (!updatedQuestion) {
            return next(new ErrorHandler("Failed to update question", 500));
        }

        res.status(200).json({
            success: true,
            message: "Question updated successfully.",
            question: updatedQuestion,
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});

// export const makePublic = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {
//     try {
//         const { questionId, public} = req.body;  // Destructure to get questionId and data
//         const questionData = await QuestionBank.findById(questionId);
//         if (!questionData) {
//             return next(new ErrorHandler("Question not found", 404));
//         }

       
//         res.status(200).json({
//             success: true,
//             message: "Question updated successfully.",
//             question: updatedQuestion,
//         });
//     } catch (error: any) {
//         return next(new ErrorHandler(error.message, 500));
//     }
// });

export const deleteQuestion = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { questionId } = req.params; // Extract questionId from request body
        const questionData = await QuestionBank.findById(questionId);
        if (!questionData) {
            return next(new ErrorHandler("Question not found", 404));
        }
        const deletedQuestion = await QuestionBank.findByIdAndDelete(questionId);
        if (!deletedQuestion) {
            return next(new ErrorHandler("Failed to delete question", 500));
        }

        res.status(200).json({
            success: true,
            message: "Question deleted successfully.",
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});


// Get all questions
export const getAllQuestions = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const questions = await QuestionBank.find().populate("createdBy", "name email");
        res.status(200).json({
            success: true,
            questions,
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});

// Get questions by course
export const getQuestionsByCourse = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { courseId } = req.params;
        const questions = await QuestionBank.find({ course: courseId });
        res.status(200).json({
            success: true,
            questions,
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});

// Get questions by topic
export const getQuestionsByTopic = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { topic } = req.body;
        const questions = await QuestionBank.find({ topic }).populate(" createdBy", "name email");
        res.status(200).json({
            success: true,
            questions,
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});

// Get questions by subtopic
export const getQuestionsBySubTopic = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { subTopic } = req.params;
        const questions = await QuestionBank.find({ subTopic }).populate("course createdBy", "name email");
        res.status(200).json({
            success: true,
            questions,
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});


