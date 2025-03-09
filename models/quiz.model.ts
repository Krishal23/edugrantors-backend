import mongoose, { Schema, Document, Model } from "mongoose";
import { IUser } from "./user.model";

interface IOption {
  text: string;
  isCorrect: boolean;
}

interface IQuestion extends Document {
  _id: Schema.Types.ObjectId; // Add this line
  type: "single" | "multiple" | "numerical" | "phrase";
  question: string;
  options?: IOption[];
  correctAnswer?: string | number | string[];
  marks: number;
  negativeMarks?: number;
  explanation?: string;
  image?: {
    public_id: string;
    url: string;
  };
  imageExplain?: {
    public_id: string;
    url: string;
  };
  createdBy?: IUser;
  topic?: string;
  subTopic?: string; // Optional sub-topic
}

interface IQuiz extends Document {
  _id: Schema.Types.ObjectId; // Add this line
  title: string;
  description: string;
  questions: IQuestion[];
  maxMarks: number;
  duration: number;
  course: Schema.Types.ObjectId;
  startTime: Date;
  isLive?: boolean;
  attemptedBy?: IUser[];
  totalAttempts?: number; // Add this line
}

const optionSchema = new Schema<IOption>({
  text: { type: String, required: true },
  isCorrect: { type: Boolean, required: true },
});

const questionSchema = new Schema<IQuestion>({
  type: {
    type: String,
    enum: ["single", "multiple", "numerical", "phrase"],
    required: true,
  },
  question: { type: String, required: true },
  options: [optionSchema],
  correctAnswer: Schema.Types.Mixed,
  marks: { type: Number, default: 0 },
  negativeMarks: { type: Number, default: 0 },
  explanation: { type: String },
  image: {
    public_id: {
      type: String,
    },
    url: {
      type: String,
    },
  },
  imageExplain: {
    public_id: {
      type: String
    },
    url: {
      type: String
    }
  },
  topic: {
    type: String,
  },
  subTopic: {
    type: String,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    // required: true,
  },
});

const quizSchema = new Schema<IQuiz>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    questions: { type: [questionSchema], required: true },
    duration: { type: Number, required: true },
    startTime: { type: Date },
    maxMarks: { type: Number, required: true },
    isLive: {
      type: Boolean,
      default: false,
    },
    attemptedBy: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        name: { type: String, required: true },
        marks:{type: Number}
      },
    ],
    totalAttempts: {
      // Add this block
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const QuizModel: Model<IQuiz> = mongoose.model("Quiz", quizSchema);
export { IOption, IQuestion, IQuiz, QuizModel };
