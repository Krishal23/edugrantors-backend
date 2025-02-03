import mongoose, { Document, Model, Schema } from "mongoose";
import { IUser } from "./user.model";

interface IOption {
  text: string;
  isCorrect: boolean;
}

interface IQuestion extends Document {
  courseId: Schema.Types.ObjectId;
  topic?: string;
  subTopic?: string; // Optional sub-topic
  public?: boolean;
  type: "single" | "multiple" | "numerical" | "phrase";
  question: string;
  options?: IOption[];
  correctAnswer: string | number | string[];
  marks: number;
  negativeMarks?:number;
  explanation?: string;
  image?: {
    public_id: string;
    url: string;
  };
  createdBy: IUser;
}

const optionSchema = new Schema<IOption>({
  text: { type: String, required: true },
  isCorrect: { type: Boolean, required: true },
});

const questionBankSchema = new Schema<IQuestion>({
  courseId: {
    type: Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },
  topic: {
    type: String,
  },
  subTopic: {
    type: String,
  },
  type: {
    type: String,
    enum: ["single", "multiple", "numerical", "phrase"],
    required: true,
    unique: false
  },
  public: {
    type: Boolean,
    default:false
  },
  question: {
    type: String,
    required: true,
  },
  options: [optionSchema],
  correctAnswer: {
    type: Schema.Types.Mixed, 
    required: true,
  },
  marks: {
    type: Number,
    required: true,
  },
  negativeMarks: {
    type: Number,
    default: 0,
  },
  explanation: { type: String },
  image: { 
      public_id: {
          type: String
      },
      url: {
          type: String
      }
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
}, { timestamps: true });

const QuestionBank: Model<IQuestion> = mongoose.model("QuestionBank", questionBankSchema);
export default QuestionBank;
