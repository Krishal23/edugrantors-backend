import dotenv from 'dotenv';
dotenv.config();

import mongoose, { Document, Model, Schema } from "mongoose";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
// import { useState} from 'react';


const emailRegexPattern: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface IQuizProgress {
    quizId: Schema.Types.ObjectId; // Reference to the quiz
    courseId: Schema.Types.ObjectId; // Reference to the course
    maxMarks: number; // Total marks of the quiz
    marksScored: number; // Marks scored by the user
    totalQuestionsAttempted: number; // Number of questions attempted
    totalCorrectQuestions: number; // Number of correct answers
    completionTime?: number; // Time taken to complete the quiz (in minutes)
    isCompleted?: boolean; // Whether the quiz is completed
    questions: {
        questionId: Schema.Types.ObjectId; // Reference to the question
        selectedAnswer: string | number | string[] | null; // User's answer (null if not attempted)
        isCorrect: boolean | null; // Whether the answer is correct (null if not attempted)
        isAttempted: boolean; // Whether the question was attempted
    }[];
}


interface ITestAnswer {
    questionId: Schema.Types.ObjectId; // Reference to the question in the quiz
    selectedAnswer: string | number | string[]; // User's answer
    isCorrect?: boolean; // Whether the answer is correct (optional to allow evaluation later)
}

interface ITestAttempt {
    courseId: Schema.Types.ObjectId; // Reference to the course
    quizId: Schema.Types.ObjectId; // Reference to the quiz in the course
    answers: ITestAnswer[]; // Array of user answers
    totalScore?: number; // Total score for the attempt (optional to allow evaluation later)
    attemptedAt: Date; // Timestamp of the attempt
}

export interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    contactnumber: string;
    classes: string;
    stream: string;
    targetYear: string,
    gender: string;
    avatar: {
        public_id: string;
        url: string;
    };
    role: string;
    isVerified: boolean;
    courses: Array<{ courseId: string, courseName: string }>;
    comparePassword: (password: string) => Promise<boolean>;
    SignAccessToken: () => string;
    SignRefreshToken: () => string;
    testsAttempted: ITestAttempt[]; // Array of test attempts
    quizProgress: IQuizProgress[]; // Track progress for quizzes
    coursesCreated: Array<{ courseId: Schema.Types.ObjectId, courseName: string }>; // by teachers 
}



const quizProgressSchema = new Schema<IQuizProgress>({
    quizId: { type: Schema.Types.ObjectId, ref: "Quiz", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    maxMarks: { type: Number, required: true },
    marksScored: { type: Number, default: 0 },
    totalQuestionsAttempted: { type: Number, default: 0 },
    totalCorrectQuestions: { type: Number, default: 0 },
    completionTime: { type: Number }, // Optional field
    isCompleted: { type: Boolean, default: false },
    questions: [
        {
            questionId: { type: Schema.Types.ObjectId, ref: "Quiz.questions", required: true },
            selectedAnswer: { type: Schema.Types.Mixed, default: null }, // String, number, or array, or null
            isCorrect: { type: Boolean, default: null }, // True, false, or null
            isAttempted: { type: Boolean, default: false }, // Whether the question was attempted
        },
    ],
});

const testAnswerSchema = new Schema<ITestAnswer>({
    questionId: { type: Schema.Types.ObjectId, ref: "Course.quizzes.questions", required: true },
    selectedAnswer: { type: Schema.Types.Mixed, required: true }, // String, number, or array
    isCorrect: { type: Boolean }, // Optional
});

const testAttemptSchema = new Schema<ITestAttempt>({
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    quizId: { type: Schema.Types.ObjectId, ref: "Course.quizzes", required: true },
    answers: { type: [testAnswerSchema], required: true },
    totalScore: { type: Number }, // Optional for calculated results
    attemptedAt: { type: Date, default: Date.now },
});



const userSchema: Schema<IUser> = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Please enter your name"],
    },
    email: {
        type: String,
        required: [true, "Please enter your email"],
        validate: {
            validator: (email: string) => emailRegexPattern.test(email),
            message: "Please enter a valid email"
        },
        unique: true,
        index: true // Indexing for performance
    },
    password: {
        type: String,
        select: false,
        minlength: [6, "Password must be at least 6 characters"]
    },
    contactnumber: {
        type: String,
        // required: true
    },
    classes: {
        type: String,
        // required: true
    },
    stream: {
        type: String,
    },
    targetYear: {
        type: String,
    },
    gender: {
        type: String,
        // required: true
    },
    avatar: {
        public_id: {
            type: String
        },
        url: {
            type: String
        }
    },
    role: {
        type: String,
        default: "user"
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    courses: [
        {
            courseId: {
                type: String
            },
            courseName: {
                type: String
            },

        }
    ],
    quizProgress: {
        type: [quizProgressSchema],
        default: [],
    },
    testsAttempted: {
        type: [testAttemptSchema],
        default: []
    },
    coursesCreated: [
        {
            courseId: {
                type: Schema.Types.ObjectId,
            },
            courseName: {
                type: String,
            }
        }

    ],
}, { timestamps: true });

// Hash Password before saving
userSchema.pre<IUser>('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Sign Access Token
userSchema.methods.SignAccessToken = function () {
    const accessTokenSecret = process.env.ACCESS_TOKEN as jwt.Secret;
    if (!accessTokenSecret) {
        throw new Error('Access token secret is not defined in environment variables');
    }
    const expiresIn = process.env.ACCESS_TOKEN_EXPIRE ? parseInt(process.env.ACCESS_TOKEN_EXPIRE) : '300s';
    const options: jwt.SignOptions = {
        expiresIn,
    };
    return jwt.sign({ userId: this._id }, accessTokenSecret, options);
};

// Sign Refresh Token
userSchema.methods.SignRefreshToken = function () {
    const refreshTokenSecret = process.env.REFRESH_TOKEN as jwt.Secret;
    if (!refreshTokenSecret) {
        throw new Error('Refresh token secret is not defined in environment variables');
    }
    const expiresIn = process.env.REFRESH_TOKEN_EXPIRE ? parseInt(process.env.REFRESH_TOKEN_EXPIRE) : '1200s';
    const options: jwt.SignOptions = {
        expiresIn,
    };
    return jwt.sign({ userId: this._id }, refreshTokenSecret, options);
};

// Compare passwords
userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
};

const userModel = mongoose.model<IUser>('User', userSchema);

export default userModel;
