import mongoose, { Document, Model, Schema } from "mongoose";
import { IUser } from "./user.model";
import { IQuiz, QuizModel } from "./quiz.model";

interface IComment extends Document {
  user: IUser;
  question: string;
  questionReplies: IComment[];
}
interface IReview extends Document {
  user: IUser;
  rating: number;
  comment: string;
  commentReplies: IComment[];
}
interface ILink extends Document {
  title: string;
  url: string;
}
export interface ICoupons extends Document {
  couponId: string;
  courseId: Schema.Types.ObjectId;
  couponHolder?: string;
  beneficiary?: IUser[];
  count: number;
  maxAllowed: number;
  discount: number;
  validity: Date;
  isActive?: boolean;
}

interface ICourseData extends Document {
  title: string;
  description: string;
  videoUrl: string;
  videoThumbnail: object;
  videoSection: string;
  videoLength: number;
  videoPlayer: string;
  links: ILink[];
  suggestion: string;
  questions: IComment[];
}

interface ICourse extends Document {
  name: string;
  description: string;
  price: number;
  estimatedPrice?: number;
  thumbnail: {
    public_id: string;
    url: string;
  };
  tags: string;
  level: string;
  demoUrl: string;
  benefits: {
    title: string;
  }[];
  prerequisites: {
    title: string;
  }[];
  reviews: IReview[];
  courseData: ICourseData[];
  ratings?: number;
  purchased?: number;
  quizzes: IQuiz[];
  studentsEnrolled: IUser[];
  teacher: IUser;
  coupons: ICoupons[];
  isPublic?: boolean;
}

interface IQuestion extends Document {
  question: string;
  type: string;
  options: { text: string }[];
  correctAnswer: string | string[];
  marks: number;
  negativeMarks: number;
  explanation: string;
  image: { public_id: string; url: string };
}

const couponSchema = new Schema<ICoupons>({
  couponId: {
    type: String,
    //   required: true,
    unique: true,
  },
  courseId: {
    type: Schema.Types.ObjectId,
    // required:true,
  },
  couponHolder: {
    type: String,
    //   required: true,
  },
  beneficiary: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  count: {
    type: Number,
    default: 0,
  },
  maxAllowed: {
    type: Number,
    required: true,
  },
  discount: {
    type: Number,
    required: true,
  },
  validity: {
    type: Date,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

const reviewSchema = new Schema<IReview>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true, // Make sure this is required if applicable
    },
    rating: {
      type: Number,
    },
    comment: {
      type: String,
      required: true, // Ensure comment is required
    },
    commentReplies: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        comment: {
          type: String,
          required: true,
        },
      },
    ],
  },
  { timestamps: true }
);

const linkSchema = new Schema<ILink>({
  title: {
    type: String,
  },
  url: {
    type: String,
  },
});

const commentSchema = new Schema<IComment>(
  {
    user: {
      type: Object,
      ref: "User",
    },
    question: {
      type: String,
    },
    questionReplies: {
      type: [Object],
    },
  },
  { timestamps: true }
);
const courseDataSchema = new Schema<ICourseData>({
  videoUrl: {
    type: String,
  },
  title: {
    type: String,
  },
  videoSection: {
    type: String,
  },
  description: {
    type: String,
  },
  videoLength: {
    type: Number,
  },
  videoPlayer: {
    type: String,
  },
  links: {
    type: [linkSchema],
  },
  suggestion: {
    type: String,
  },
  questions: {
    type: [commentSchema],
  },
});

const courseSchema = new Schema<ICourse>(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    estimatedPrice: {
      type: Number,
    },
    thumbnail: {
      public_id: {
        type: String,
      },
      url: {
        type: String,
      },
    },

    tags: {
      type: String,
      required: true,
    },
    level: {
      type: String,
      required: true,
    },
    demoUrl: {
      type: String,
      required: true,
    },
    benefits: {
      type: [
        {
          title: String,
        },
      ],
    },
    prerequisites: {
      type: [
        {
          title: String,
        },
      ],
    },
    reviews: {
      type: [reviewSchema],
    },
    courseData: {
      type: [courseDataSchema],
    },
    ratings: {
      type: Number,
      default: 0,
    },
    purchased: {
      type: Number,
      default: 0,
    },
    studentsEnrolled: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    quizzes: {
      type: [QuizModel.schema],
      default: [],
    },
    teacher: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    coupons: {
      type: [couponSchema],
      default: [],
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const CourseModel: Model<ICourse> = mongoose.model("Course", courseSchema);
export default CourseModel;

export { IQuestion };
