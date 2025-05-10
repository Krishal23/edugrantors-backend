import { NextFunction, Request, Response } from "express";
import { CatchAsyncErrror } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import cloudinary from "cloudinary";
import { createCourse, getAlCoursesService } from "../services/course.service";
import CourseModel, { ICoupons, IQuestion } from "../models/course.models";
import { redis } from "../utils/redis";
import mongoose from "mongoose";
import ejs, { Template } from "ejs";
import path from "path";
import sendMail from "../utils/sendMail";
import userModel, { IQuizProgress } from "../models/user.model";
import NotificationModel from "../models/notificationModel";
import { IQuiz, IQuestion as IQuizQuestion } from "../models/quiz.model";

//upload course
export const uploadCourse = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    // console.log("hello");
    try {
      const data = req.body;
      const userId = req.user?._id;
      data.teacher = userId;
      data.studentsEnrolled = data.studentsEnrolled || []; // Initialize if undefined
      data.studentsEnrolled.push(userId);
      data.purchased = (data.purchased || 0) + 1;

      const thumbnail = data.thumbnail;
      if (thumbnail) {
        const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
          folder: "courses",
        });
        data.thumbnail = {
          public_id: myCloud.public_id,
          url: myCloud.secure_url,
        };
      }

      createCourse(data, res, next);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

//edit course
export const editCourse = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;
      const thumbnail = data.thumbnail;
      const courseId = req.params.id;

      const courseData = await CourseModel.findById(courseId);
      if (!courseData) {
        return next(new ErrorHandler("Course not found", 404));
      }

      let courseDataPlain = courseData.toObject();

      data.courseData = Array.isArray(courseDataPlain.courseData)
        ? courseDataPlain.courseData.map((section, index) => ({
          ...section,
          ...(data.courseData?.[index] || {}),
          questions: section.questions || [], // Ensure questions remain unchanged
        }))
        : courseDataPlain.courseData;


      // Check if there's a thumbnail to update
      if (thumbnail) {
        if (!thumbnail.startsWith("https")) {
          if (courseData.thumbnail?.public_id) {
            await cloudinary.v2.uploader.destroy(courseData.thumbnail.public_id);
          }

          const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
            folder: "courses",
          });

          data.thumbnail = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
          };
        } else {
          data.thumbnail = courseData.thumbnail;
        }
      }

      const course = await CourseModel.findByIdAndUpdate(
        courseId,
        { $set: data },
        { new: true }
      );


      if (!course) {
        return next(new ErrorHandler("Failed to update course", 500));
      }

      res.status(201).json({
        success: true,
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

export const updateCourse = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { id } = req.params;
      const data = req.body;

      const course = await CourseModel.findById(id).session(session);
      if (!course) {
        await session.abortTransaction();
        return next(new ErrorHandler("Course not found", 404));
      }

      Object.assign(course, data);
      await course.save({ session });

      try {
        await redis.set(id, JSON.stringify(course), "EX", 604800); // 7 days cache
      } catch (cacheError) {
        console.error("Cache update failed:", cacheError);
        // Continue even if cache fails
      }

      await session.commitTransaction();

      res.status(200).json({
        success: true,
        course
      });
    } catch (error) {
      await session.abortTransaction();
      return next(new ErrorHandler(error.message, 500));
    } finally {
      session.endSession();
    }
  }
);

export const addCoupons = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        code: couponId,
        couponHolder,
        maxAllowed,
        discount,
        validity,
      } = req.body;
      const courseId = req.params.id;

      // Validate input fields
      if (!couponId || !maxAllowed || !discount || !validity) {
        return next(new ErrorHandler("All fields are required", 400));
      }

      // Find the course
      const course = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      // Check if a coupon with the same ID already exists
      const existingCoupon = course.coupons.find(
        (coupon) => coupon.couponId === couponId
      );
      if (existingCoupon) {
        return next(
          new ErrorHandler("Coupon with this ID already exists", 400)
        );
      }

      // Add the new coupon to the course
      course.coupons.push({
        courseId,
        couponId,
        maxAllowed,
        discount,
        validity: new Date(validity),
        isActive: true,
        count: 0,
      } as any);

      // Save the course with the updated coupons
      await course.save();

      res.status(201).json({
        success: true,
        message: "Coupon added successfully",
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);
export const getCoupons = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = req.params.id;
      const course = await CourseModel.findById(courseId);

      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }
      const coupons = course?.coupons;
      res.status(201).json({
        success: true,
        message: "Coupon added successfully",
        coupons,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);
export const validateCoupon = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: courseId, couponId } = req.params;

      const course = await CourseModel.findById(courseId);

      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      const coupons = course.coupons;
      if (!coupons || coupons.length === 0) {
        return next(
          new ErrorHandler("No coupons available for this course", 404)
        );
      }

      const coupon = coupons.find(
        (c: any) =>
          c.couponId === couponId &&
          c.isActive &&
          new Date(c.validity) >= new Date() &&
          c.count < c.maxAllowed
      );

      if (!coupon) {
        return next(new ErrorHandler("Invalid or expired coupon", 400));
      }

      res.status(200).json({
        success: true,
        message: "Coupon validated successfully",
        discount: coupon.discount,
        coupon,
      });
    } catch (error: any) {
      return next(
        new ErrorHandler(error.message || "Internal Server Error", 500)
      );
    }
  }
);

export const toggleCouponActive = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId, couponId } = req.params;

      // Find the course by ID
      const course = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      // Find the specific coupon within the course
      const coupon = course.coupons.find((c: any) => c.couponId === couponId);
      if (!coupon) {
        return next(new ErrorHandler("Coupon not found", 404));
      }

      // Toggle the `isActive` property
      coupon.isActive = !coupon.isActive;

      // Save the updated course document
      await course.save();

      res.status(200).json({
        success: true,
        message: `Coupon ${couponId} is now ${coupon.isActive ? "active" : "inactive"
          }`,
        coupon,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Create quiz -- by admin
export const createQuiz = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, description, questions, duration, startTime, maxMarks } =
        req.body;
      const courseId = req.params.id;
      const courseData = await CourseModel.findById(courseId);
      if (!courseData) {
        return next(new ErrorHandler("Course not found", 404));
      }

      if (
        !title ||
        !description ||
        !questions ||
        !Array.isArray(questions) ||
        !duration ||
        !startTime
      ) {
        return next(
          new ErrorHandler("Please provide all required fields.", 400)
        );
      }

      const processedQuestions = await Promise.all(
        questions.map(async (question: any) => {
          if (question.image) {
            // Upload image to Cloudinary
            const uploadedImage = await cloudinary.v2.uploader.upload(
              question.image,
              {
                folder: "quizzes/questions",
              }
            );
            question.image = {
              public_id: uploadedImage.public_id,
              url: uploadedImage.secure_url,
            };
          }

          if (!question.type || !question.question) {
            throw new Error("Each question must have a type and a question.");
          }
          if (
            ["single", "multiple"].includes(question.type) &&
            !Array.isArray(question.options)
          ) {
            throw new Error(
              "Questions of type 'single' or 'multiple' must include options."
            );
          }

          return question;
        })
      );

      // Create quiz object
      const newQuiz = {
        title,
        description,
        questions: processedQuestions,
        duration,
        course: courseId,
        startTime,
        maxMarks,
      };

      courseData.quizzes.push(newQuiz as any);

      await courseData.save();

      res.status(201).json({
        success: true,
        message: "Quiz created and added to the course successfully.",
        quiz: newQuiz,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Update quiz details
export const updateQuiz = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId, quizId } = req.params;
      const {
        title,
        description,
        questions,
        duration,
        startTime,
        maxMarks,
        isLive,
      } = req.body;

      const courseData = await CourseModel.findById(courseId);
      if (!courseData) {
        return next(new ErrorHandler("Course not found", 404));
      }

      const quizIndex = courseData.quizzes.findIndex(
        (quiz: any) => quiz._id.toString() === quizId
      );
      if (quizIndex === -1) {
        return next(new ErrorHandler("Quiz not found", 404));
      }

      const quiz = courseData.quizzes[quizIndex];

      if (title) quiz.title = title;
      if (description) quiz.description = description;
      if (duration) quiz.duration = duration;
      if (startTime) quiz.startTime = startTime;
      if (maxMarks) quiz.maxMarks = maxMarks;
      quiz.isLive = isLive;

      if (questions && Array.isArray(questions)) {
        const processedQuestions = await Promise.all(
          questions.map(async (question: any) => {
            if (question.image && typeof question.image === "string") {
              // Upload image to Cloudinary
              const uploadedImage = await cloudinary.v2.uploader.upload(
                question.image,
                {
                  folder: "quizzes/questions",
                }
              );
              question.image = {
                public_id: uploadedImage.public_id,
                url: uploadedImage.secure_url,
              };
            }

            // Validate each question type and options
            if (!question.type || !question.question) {
              throw new Error("Each question must have a type and a question.");
            }
            if (
              ["single", "multiple"].includes(question.type) &&
              !Array.isArray(question.options)
            ) {
              throw new Error(
                "Questions of type 'single' or 'multiple' must include options."
              );
            }

            return question;
          })
        );

        // Replace the existing questions with the updated ones
        quiz.questions = processedQuestions;
        quiz.maxMarks = processedQuestions.reduce(
          (total: number, question: any) => total + (question.marks || 0),
          0
        );
      }

      await courseData.save();

      res.status(200).json({
        success: true,
        message: "Quiz updated successfully.",
        quiz,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Delete a specific question from a quiz
export const deleteQuestion = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId, quizId, questionId } = req.params;


      // Fetch the course by ID
      const courseData = await CourseModel.findById(courseId);
      if (!courseData) {
        return next(new ErrorHandler("Course not found", 404));
      }

      // Find the quiz in the course
      const quizIndex = courseData.quizzes.findIndex(
        (quiz: any) => quiz._id.toString() === quizId
      );
      if (quizIndex === -1) {
        return next(new ErrorHandler("Quiz not found", 404));
      }

      const quiz = courseData.quizzes[quizIndex];

      // Find the question in the quiz
      const questionIndex = quiz.questions.findIndex(
        (question: any) => question._id.toString() === questionId
      );
      if (questionIndex === -1) {
        return next(new ErrorHandler("Question not found", 404));
      }
      // Get the marks of the question to be deleted
      const questionMarks = quiz.questions[questionIndex]?.marks || 0;

      // Reduce the maxMarks by the marks of the deleted question
      quiz.maxMarks = Math.max(0, quiz.maxMarks - questionMarks);

      // Remove the question
      quiz.questions.splice(questionIndex, 1);

      // Save the updated course document
      await courseData.save();

      res.status(200).json({
        success: true,
        message: "Question deleted successfully.",
        quiz,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Get quiz details --by courseId
export const getQuizzes = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = req.params.id;

      // Validate input
      if (!courseId) {
        return next(
          new ErrorHandler("Please provide both courseId and quizId.", 400)
        );
      }

      // Fetch the course and quiz
      const courseData = await CourseModel.findById(courseId);
      if (!courseData) {
        return next(new ErrorHandler("Course not found", 404));
      }

      const quizzes = courseData.quizzes; // Original array of quizzes
      const selectedQuizzes = quizzes.map((quiz) => ({
        id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        startTime: quiz.startTime,
        duration: quiz.duration,
        isLive: quiz.isLive,
      })); // Select only 'id' and 'name'

      if (!selectedQuizzes) {
        return next(new ErrorHandler("Quiz not found in the course", 404));
      }

      // Return quiz details
      res.status(200).json({
        success: true,
        message: "Quizzes in course fetched successfully.",
        selectedQuizzes,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);
// Get quiz details --by quizId
export const getQuizDetails = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // const { courseId, quizId } = req.body;
      const courseId = req.params.cid;
      const quizId = req.params.qid;

      // Validate input
      if (!courseId || !quizId) {
        return next(
          new ErrorHandler("Please provide both courseId and quizId.", 400)
        );
      }

      // Fetch the course and quiz
      const courseData = await CourseModel.findById(courseId);
      if (!courseData) {
        return next(new ErrorHandler("Course not found", 404));
      }

      const quiz = courseData.quizzes.find((quiz: IQuiz) => quiz._id.toString() === quizId); // Fetch quiz by ID from course's quizzes
      if (!quiz) {
        return next(new ErrorHandler("Quiz not found in the course", 404));
      }

      // Return quiz details
      res.status(200).json({
        success: true,
        message: "Quiz details fetched successfully.",
        result: {
          title: quiz.title,
          description: quiz.description,
          duration: quiz.duration,
          questions: quiz.questions.map((question: any) => ({
            questionId: question._id,
            question: question.question,
            options: question.options.map((option: any) => ({
              text: option.text,
            })),
            type: question.type,
            marks: question.marks,
            negativeMarks: question.negativeMarks,
            image: question.image,
          })),
          maxMarks: quiz.maxMarks,
        },
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);
// Get quiz details --for admin
export const getQuizDetailsByAdmin = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = req.params.cid;
      const quizId = req.params.qid;

      // Validate input
      if (!courseId || !quizId) {
        return next(
          new ErrorHandler("Please provide both courseId and quizId.", 400)
        );
      }

      // Fetch the course and quiz
      const courseData = await CourseModel.findById(courseId);
      if (!courseData) {
        return next(new ErrorHandler("Course not found", 404));
      }

      const quiz = courseData.quizzes.find((quiz: IQuiz) => quiz._id.toString() === quizId); // Fetch quiz by ID from course's quizzes
      if (!quiz) {
        return next(new ErrorHandler("Quiz not found in the course", 404));
      }

      const courseName = courseData?.name;

      // Check for duplicate question IDs
      const uniqueQuestions: IQuizQuestion[] = [];
      const questionIds = new Set<string>();

      quiz.questions.forEach((question: IQuizQuestion) => {
        if (!questionIds.has(question._id.toString())) {
          questionIds.add(question._id.toString());
          uniqueQuestions.push(question);
        }
      });

      // Update the quiz if duplicates were found
      if (uniqueQuestions.length !== quiz.questions.length) {
        quiz.questions = uniqueQuestions as any;
        await courseData.save(); // Save the updated course data
      }

      // Return quiz details
      res.status(200).json({
        success: true,
        message: "Quiz details fetched successfully.",
        quiz,
        courseName,
      });
    } catch (error: any) {
      console.error("Error fetching quiz details:", error);
      return next(
        new ErrorHandler(error.message || "Internal Server Error", 500)
      );
    }
  }
);

const assessResponses = (quiz: any, responses: any[]) => {
  let totalCorrectQuestions = 0;
  let totalQuestionsAttempted = 0;
  let marksScored = 0;

  const assessedResponses = responses.map((response) => {
    const question = quiz.questions.find(
      (q: any) => q._id.toString() === response.questionId
    );

    if (!question) {
      return {
        ...response,
        isCorrect: false,
        score: 0, // No score for invalid question
      };
    }

    let isCorrect = false;
    let score = 0;

    switch (question.type) {
      case "single":
      case "phrase":
        isCorrect = question.correctAnswer === response.selectedAnswer;
        break;
      case "multiple":
        isCorrect =
          Array.isArray(response.selectedAnswer) &&
          question.correctAnswer.length === response.selectedAnswer.length &&
          question.correctAnswer.every((answer: string) =>
            response.selectedAnswer.includes(answer)
          );
        break;
      case "numerical":
        if (typeof question.correctAnswer === "number" && typeof response.selectedAnswer === "number") {
          const tolerance = 1e-9;
          isCorrect = Math.abs(question.correctAnswer - response.selectedAnswer) < tolerance;
        } else {
          isCorrect = String(question.correctAnswer).trim() === String(response.selectedAnswer).trim();
        }
        console.log(question.correctAnswer, response.selectedAnswer, isCorrect);
        break;
      default:
        isCorrect = false;
    }

    totalQuestionsAttempted++;

    if (response?.isAttempted) {
      if (isCorrect) {
        totalCorrectQuestions++;
        score = question.marks;
        marksScored += score;
      } else {
        score = -(question.negativeMarks || 0); // Subtract negative marks
        marksScored += score;
      }
    }
    return {
      ...response,
      isCorrect,
      score,
    };
  });


  // Ensure marksScored does not go below zero
  marksScored = Math.max(marksScored);

  return {
    assessedResponses,
    totalCorrectQuestions,
    totalQuestionsAttempted,
    marksScored,
  };
};

//  attemptQuiz --byuser
export const attemptQuiz2 = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        courseId,
        quizId,
        questions: responses,
        completionTime,
      } = req.body.result;
      const userId: any = req.user?._id;
      // console.log(userId, "userId");

      if (!courseId || !quizId || !responses) {
        return next(new ErrorHandler("Please provide all required fields.", 400));
      }

      const courseData = await CourseModel.findById(courseId);
      if (!courseData) {
        return next(new ErrorHandler("Course not found", 404));
      }

      const quiz = courseData.quizzes.find((quiz: IQuiz) => quiz._id.toString() === quizId);
      if (!quiz) {
        return next(new ErrorHandler("Quiz not found in the course", 404));
      }
      if (!quiz.isLive) {
        return next(new ErrorHandler("This quiz is not currently live.", 403));
      }

      const user = await userModel.findById(userId);
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      const isEnrolled = user.courses.some((course: any) => course.courseId?.toString() === courseId?.toString());
      if (!isEnrolled) {
        return next(new ErrorHandler("You are not enrolled in this course.", 403));
      }

      // Remove existing attempt if found
      user.quizProgress = user.quizProgress.filter(
        (attempt: any) =>
          !(attempt.courseId.toString() === courseId && attempt.quizId.toString() === quizId)
      );

      const {
        assessedResponses,
        totalCorrectQuestions,
        totalQuestionsAttempted,
        marksScored,
      } = assessResponses(quiz, responses);
      // console.log(assessedResponses, "assessedResponses"); 

      const result: IQuizProgress = {
        quizId,
        courseId,
        totalQuestionsAttempted,
        totalCorrectQuestions,
        maxMarks: quiz.maxMarks,
        marksScored,
        completionTime,
        questions: assessedResponses,
      };
      user.quizProgress.push(result);
      // console.log(user.quizProgress, "user.quizProgress");
      await user.save();

      // console.log("123huafosdv", quiz.attemptedBy);
      // console.log(userId, "userAlreadyAttemptedqwef");

      // Ensure quiz.attemptedBy is an array before using .some()
      const userAlreadyAttempted = Array.isArray(quiz.attemptedBy) && quiz.attemptedBy.some(
        (attempt: any) => attempt._id.toString() === userId.toString()
      );

      // console.log("userAlreadyAttempted:", userAlreadyAttempted);

      if (!userAlreadyAttempted) {
        quiz.attemptedBy = quiz.attemptedBy || [];
        quiz.attemptedBy.push({ _id: userId, name: user.name } as any);
        quiz.totalAttempts = (quiz.totalAttempts || 0) + 1;
      }

      await courseData.save();
      // console.log("result", result);

      res.status(200).json({
        success: true,
        message: "Quiz attempted successfully.",
        quiz,
        result,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Review quiz

export const reviewQuizAttempt = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      const { cid: courseId, qid: quizId } = req.params;

      // Validate input
      if (!courseId || !quizId || !userId) {
        return next(
          new ErrorHandler("Please provide userId, courseId, and quizId.", 400)
        );
      }

      // Fetch user data
      const user = await userModel.findById(userId);
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      // Check if the user has attempted the quiz
      const existingAttempt = user.quizProgress.find(
        (attempt: any) =>
          attempt.courseId.toString() === courseId &&
          attempt.quizId.toString() === quizId
      );
      if (!existingAttempt) {
        return next(new ErrorHandler("You have not attempted this quiz.", 404));
      }

      // Fetch the course and quiz
      const course = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      const quiz = course.quizzes.find((quiz: IQuiz) => quiz._id.toString() === quizId);
      if (!quiz) {
        return next(new ErrorHandler("Quiz not found in the course", 404));
      }
      // console.log(quiz, "quiz");

      // Create a map of attempted answers for quick lookup
      const attemptedAnswersMap = new Map(
        existingAttempt.questions.map((answer: any) => [
          answer.questionId.toString(),
          answer,
        ])
      );
      // console.log(attemptedAnswersMap, "attemptedAnswersMap");

      // Prepare the response with all questions
      const reviewedAnswers = quiz.questions.map((question: any) => {
        const attempt = attemptedAnswersMap.get(question._id.toString());
        const selectedAnswer = attempt ? attempt.selectedAnswer : null;
        const isAttempted = attempt ? attempt.isAttempted : false;

        let isCorrect = false;
        if (question.type === "multiple") {
          const correctAnswer = Array.isArray(question.correctAnswer)
            ? question.correctAnswer.sort()
            : [];
          isCorrect =
            selectedAnswer &&
            Array.isArray(selectedAnswer) &&
            correctAnswer.length === selectedAnswer.length &&
            correctAnswer.every((answer: string) => selectedAnswer.includes(answer));
        } else {
          isCorrect = String(selectedAnswer).trim() === String(question.correctAnswer).trim();
        }

        // console.log(isCorrect, "isCorrect");

        return {
          type: question.type,
          question: question.question,
          options: question.options.map((option: any) => ({
            text: option.text,
          })),
          selectedAnswer: selectedAnswer || null,
          correctAnswer: question.correctAnswer,
          isCorrect,
          isAttempted,
          explanation: question.explanation,
          marks: isCorrect ? question.marks : 0,
          negativeMarks: isCorrect ? 0 : question.negativeMarks,
          image: question.image,
          imageExplain:question.imageExplain,
        };
      });

      // Update marks in the quiz's attemptedBy array
      await CourseModel.updateOne(
        { _id: courseId, "quizzes._id": quizId },
        {
          $set: {
            "quizzes.$.attemptedBy.$[user].marks": existingAttempt?.marksScored,
          },
        },
        { arrayFilters: [{ "user._id": userId }] }
      );

      res.status(200).json({
        success: true,
        message: "Quiz review fetched successfully.",
        quiz: {
          title: quiz.title,
          description: quiz.description,
          questions: reviewedAnswers,
          duration: quiz.duration,
          startTime: quiz.startTime,
          maxMarks: quiz.maxMarks,
          marksScored: existingAttempt.marksScored,
          totalQuestionsAttempted: existingAttempt.totalQuestionsAttempted,
          totalCorrectQuestions: existingAttempt.totalCorrectQuestions,
          completionTime: existingAttempt.completionTime,
        },
      });
    } catch (error: any) {
      next(new ErrorHandler(error.message, 500));
    }
  }
);

//get single course --without purchasing
export const getSingleCourse = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = req.params.id;

      // Fetch the course from MongoDB
      const course = await CourseModel.findById(courseId).select(
        "-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links -quizzes -coupons"
      );

      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      if (courseId) {
        await redis.set(courseId, JSON.stringify(course), "EX", 604800); // Cache for 7Days
      }

      return res.status(200).json({
        success: true,
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);
//get single course --without purchasing
export const getSingleCourseAdmin = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = req.params.id;

      // Fetch the course from MongoDB
      const course = await CourseModel.findById(courseId).select(
        "-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links "
      );
      // console.log(course, "course");

      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }
      const userId = course?.teacher; // ID of the teacher from the course

      let teacherName: string = "";
      if (userId) {
        const teacher = await userModel.findById(userId); // Find the user by their ID
        if (teacher) {
          teacherName = teacher?.name;
        }
      }

      // Cache the course in Redis for 1 hour
      await redis.set(courseId, JSON.stringify(course), "EX", 604800); // Cache for 7Days

      // Return the fetched course details
      return res.status(200).json({
        success: true,
        course,
        teacher: teacherName,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

//get marks of quiz
export const getUserQuizMarksAdmin = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cid: courseId, qid: quizId } = req.params; // Correctly extract params
      // console.log(courseId, "rgsd", quizId);

      // Fetch the course
      const course = await CourseModel.findById(courseId).select("quizzes");
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      // console.log(course, "cours/e");

      // Find the quiz in the course
      const quiz = course.quizzes.find((q: any) => q._id.toString() === quizId);
      if (!quiz) {
        return next(new ErrorHandler("Quiz not found in the course", 404));
      }
      // console.log(quiz.attemptedBy, "quiz");

      // Extract user IDs who attempted the quiz
      // Extract user IDs who attempted the quiz
      const userIds = (quiz?.attemptedBy ?? [])
        .filter((attempt: any) => attempt?._id) // Use `_id` instead of `userId`
        .map((attempt: any) => attempt._id);    // Map `_id` instead of `userId`
      // console.log(userIds, "userId");

      // Fetch users who attempted the quiz and get their quiz progress
      const users = await userModel.find({ _id: { $in: userIds } }).select("name quizProgress");
      console.log(users, "users");
      // Filter user progress for this quiz and course
      const results = users.map((user: any) => {
        console.log(user.quizProgress, "quizProgress for user:", user.name); // Debugging log

        const attempt = user.quizProgress.find(
          (q: any) => q.quizId.toString() === quizId && q.courseId.toString() === courseId
        );

        return attempt
          ? {
            name: user.name,
            userId: user._id,
            totalQuestionsAttempted: attempt.totalQuestionsAttempted,
            totalCorrectQuestions: attempt.totalCorrectQuestions,

            marksScored: attempt.marksScored,
          }
          : null;
      }).filter(Boolean); // Remove users who didn't attempt

      console.log(results, "Filtered results");

      // Send response
      res.status(200).json({
        success: true,
        message: "Quiz marks fetched successfully.",
        results,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

//get all courses --without purchasing
export const getAllCourses = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courses = await CourseModel.find({ isPublic: true }).select(
        "-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links"
      );
      if (!courses) {
        return next(new ErrorHandler("No courses found", 404));
      }

      // Cache the result in Redis for 1 hour
      await redis.set("allCourses", JSON.stringify(courses), "EX", 3600);

      // Return the courses
      return res.status(200).json({
        success: true,
        courses,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

//get all courses --without purchasing
export const getAllCoursesName = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Fetch only name and id fields from MongoDB
      const courses = await CourseModel.find({}, { name: 1, _id: 1 });

      if (!courses || courses.length === 0) {
        return next(new ErrorHandler("No courses found", 404));
      }

      // Cache the result in Redis for 1 hour
      await redis.set("allCoursesName", JSON.stringify(courses), "EX", 3600);

      // Return the courses
      return res.status(200).json({
        success: true,
        courses,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);


export const getCourseByUser = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Assuming req.user is populated by middleware
      const userId = req.user?._id;
      if (!userId) {
        return next(new ErrorHandler("User not authenticated", 401));
      }

      // console.log("User ID:", userId);

      // Fetch user data (if not already in req.user)
      const user = await userModel.findById(userId).populate("courses");
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      const userCourseList = user.courses;
      const courseId = req.params.id;
      // console.log("User'ss courses:", userCourseList);

      // Check if course exists in user's courses
      const courseExists = userCourseList?.find(
        (course: any) => course.courseId.toString() === courseId.toString()
      );

      if (!courseExists) {
        return next(
          new ErrorHandler("You are not eligible to access this course", 403)
        );
      }

      // Find course details in the database
      const course = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      return res.status(200).json({
        success: true,
        content: course.courseData,
      });
    } catch (error: any) {
      console.error("Error fetching course by user:", error);
      return next(
        new ErrorHandler(error.message || "Internal Server Error", 500)
      );
    }
  }
);

//add question in course
interface IAddQuestionData {
  courseId: string;
  question: string;
  contentId: string;
}
export const addQuestion = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId, question, contentId } = req.body as IAddQuestionData;
      const course = await CourseModel.findById(courseId);
      if (!mongoose.Types.ObjectId.isValid(contentId)) {
        return next(new ErrorHandler("Invalid contentId", 400));
      }
      const courseContent = course?.courseData?.find((item: any) =>
        item._id.equals(contentId)
      );
      if (!courseContent) {
        return next(new ErrorHandler("Invalid contentId", 400));
      }
      const name = req?.user?.name;
      const newQuestion: any = {
        user: req.user,
        name,
        question,
        questionReplies: [],
      };

      //add this question to our course content
      courseContent?.questions.push(newQuestion);
      const notification = await NotificationModel.create({
        userId: req.user?._id,
        title: "New Question Recieved",
        message: `You have new question in ${courseContent.title} of ${course?.name}`,
      });
      //save the updated course
      await course?.save();
      res.status(200).json({
        success: true,
        course,
        user: req.user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

//add answer in course question
interface IAddAnswerData {
  answer: string;
  courseId: string;
  contentId: any;
  questionId: string;
}

export const addAnswer = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { answer, courseId, contentId, questionId } =
        req.body as IAddAnswerData;
      // Step 1: Fetch course by ID
      const course = await CourseModel.findById(courseId);
      if (!mongoose.Types.ObjectId.isValid(contentId?._id)) {
        return next(new ErrorHandler("Invalid contentId", 400));
      }

      // Step 2: Locate the content inside the course
      const courseContent = course?.courseData?.find((item: any) =>
        item._id.equals(contentId?._id)
      );

      if (!courseContent) {
        return next(new ErrorHandler("Invalid contentContent", 400));
      }

      // Step 3: Locate the specific question within the content
      const question = courseContent?.questions?.find((item: any) =>
        item._id.equals(questionId)
      );
      if (!question) {
        return next(new ErrorHandler("Invalid questionId", 400));
      }

      // Step 4: Fetch user details from the UserModel (instead of using populate)
      const user = await userModel.findById(question.user);
      if (!user) {
        return next(new ErrorHandler("No user found with this ID", 400));
      }

      // Step 5: Create new answer object
      const newAnswer: any = {
        _id: new mongoose.Types.ObjectId(),
        user: req.user,
        answer,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Step 6: Add the new answer to the question's replies
      question.questionReplies.push(newAnswer);

      // Step 7: Save the updated course document
      await course?.save();

      // Step 8: Notification logic
      if (req.user?._id === user._id) {
        // Create a notification for the admin if the user replying is the same as the one who asked the question
        const notification = await NotificationModel.create({
          userId: req.user?._id,
          title: "New Question Reply Recieved",
          message: `You have new question reply recieved in ${courseContent.title} of ${course?.name}`,
        });
      } else {
        // Send email notification to the user who raised the question

        if (!user.email) {
          return next(
            new ErrorHandler("No email address found for the user", 400)
          );
        }

        const data = {
          name: user.name,
          title: courseContent.title,
        };

        const html = await ejs.renderFile(
          path.join(__dirname, "../mails/question-reply.ejs"),
          data
        );

        try {
          if (req.user?.email === user.email) {
            console.log(
              "The user is replying to their own question, no email will be sent."
            );
          } else {
            await sendMail({
              email: user.email,
              subject: `New reply to your question in ${courseContent.title} course`,
              template: "question-reply.ejs",
              data,
            });
          }
        } catch (error: any) {
          return next(new ErrorHandler(error.message, 500));
        }
      }

      // Step 9: Send response back to the client
      res.status(200).json({
        success: true,
        newAnswer,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

//delete comment
export const deleteComment = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // console.log("delette")
      const { courseId, contentId, questionId } = req.body;

      // console.log("Received IDs:", { courseId, contentId, questionId });

      if (!mongoose.Types.ObjectId.isValid(questionId)) {
        return next(new ErrorHandler("Invalid questionId", 400));
      }

      // Step 1: Fetch course by ID
      const course = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      // Step 2: Locate the content inside the course
      const courseContent = course.courseData.find((item: any) =>
        item._id.toString() === contentId.toString()
      );

      if (!courseContent) {
        return next(new ErrorHandler("Invalid contentId", 400));
      }

      // Step 3: Locate the specific question within the content
      const questionIndex = courseContent.questions.findIndex((item: any) =>
        item._id.toString() === questionId.toString()
      );

      // console.log("Question index:", questionIndex);

      if (questionIndex === -1) {
        return next(new ErrorHandler("Question not found", 404));
      }

      // Step 4: Authorization - Only owner, teacher, or admin can delete
      const question = courseContent.questions[questionIndex];
      const questionOwner = question?.user?._id?.toString();

      if (!questionOwner) {
        return next(new ErrorHandler("Invalid question data", 400));
      }

      const isOwner = questionOwner === (req.user as { _id: string })?._id.toString();
      const isAdminOrTeacher = req.user?.role === "admin" || req.user?.role === "teacher";

      if (!isOwner && !isAdminOrTeacher) {
        return next(new ErrorHandler("Not authorized to delete this question", 403));
      }

      // Step 5: Remove the question from the array
      courseContent.questions.splice(questionIndex, 1);

      // Step 6: Save the updated course document
      await course.save();

      // Step 7: Send response back to the client
      res.status(200).json({
        success: true,
        message: "Question deleted successfully",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);


//delete answer
export const deleteAnswer = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId, contentId, questionId, answerId } = req.body;
      // console.log(courseId, contentId, questionId, answerId)

      // Step 1: Fetch course by ID
      const course = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      // Step 2: Locate the content inside the course
      const courseContent = course?.courseData?.find((item: any) =>
        item._id.toString() === contentId.toString()
      );

      if (!courseContent) {
        return next(new ErrorHandler("Invalid contentId", 400));
      }

      // Step 3: Locate the specific question within the content
      const question = courseContent?.questions?.find((item: any) =>
        item._id.toString() === questionId.toString()
      );

      if (!question) {
        return next(new ErrorHandler("Invalid questionId", 400));
      }

      // Step 4: Find the answer within the question replies using `_id`
      const answerIndex = question.questionReplies.findIndex((reply: any) =>
        reply._id.toString() === answerId.toString()
      );

      if (answerIndex === -1) {
        return next(new ErrorHandler("Answer not found", 404));
      }
      // console.log(answerIndex)

      // Step 5: Authorization - Ensure only the owner, teacher, or admin can delete
      const answerOwner = (question.questionReplies[answerIndex].user as { _id: string })._id.toString();
      const isOwner = answerOwner === (req.user as { _id: string })?._id.toString();
      const isAdminOrTeacher = req.user?.role === "admin" || req.user?.role === "teacher";

      if (!isOwner && !isAdminOrTeacher) {
        return next(new ErrorHandler("Not authorized to delete this answer", 403));
      }

      // Step 6: Remove the answer from the array
      question.questionReplies.splice(answerIndex, 1);

      // Step 7: Save the updated course document
      await course.save();

      // Step 8: Send response back to the client
      res.status(200).json({
        success: true,
        message: "Answer deleted successfully",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);




//add reviews in course
interface IAddReviewData {
  review: string;
  rating: number;
  courseId: string;
  userId: string;
}

export const addReview = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userCourseList: any = req.user?.courses;
      const courseId = req.params.id; // Get 'id' from params

      // Check if courseId exists in user course list
      const courseExists = userCourseList?.some((course: any) => {
        return course._id.toString() === courseId.toString(); // Convert both to strings for comparison
      });

      if (!courseExists) {
        return next(
          new ErrorHandler("You are not enrolled in this course", 401)
        );
      }

      const course = await CourseModel.findById(courseId);
      const { review, rating } = req.body as IAddReviewData;
      const reviewData: any = {
        user: req.user,
        comment: review,
        rating,
      };
      course?.reviews.push(reviewData);

      let avg = 0;
      course?.reviews.forEach((rev: any) => {
        avg += rev.rating;
      });
      if (course) {
        course.ratings = avg / course?.reviews.length;
      }

      await course?.save();

      const notification = {
        title: "New Review Recieved",
        message: `You have a new review from ${req.user?.name} on ${course?.name}`,
      };

      //create notification by notification model

      res.status(200).json({
        success: true,
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

//add reply in review
interface IAddReviewData {
  comment: string;
  courseId: string;
  reviewId: string;
}

export const addReplyToReview = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { comment, courseId, reviewId } = req.body as IAddReviewData;
      const course = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      const review = course.reviews.find((rev: any) => {
        return rev._id.toString() === reviewId.toString();
      });

      if (!review) {
        return next(new ErrorHandler("Review not found", 404));
      }

      // Only include the user ID in replyData
      const replyData: any = {
        user: req.user, // Use the user's ID instead of the entire user object
        comment,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Initialize commentReplies if it doesn't exist
      if (!review.commentReplies) {
        review.commentReplies = [];
      }

      // Push the reply data into the commentReplies array
      review.commentReplies.push(replyData);

      await course.save();
      res.status(200).json({
        success: true,
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Get all courses --only for admin
export const getAdminAllCourse = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id; // Assuming `req.user` is populated with user info
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is missing.",
        });
      }

      // Fetch user from MongoDB using ID
      const user = await userModel.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }
      if (user.role === "admin") {
        const courses = await CourseModel.find();
        await redis.set("allCourses", JSON.stringify(courses), "EX", 3600);

        return res.status(200).json({
          success: true,
          courses,
        });
      }

      // Check if the user has coursesCreated field
      if (
        !Array.isArray(user.coursesCreated) ||
        user.coursesCreated.length === 0
      ) {
        return res.status(200).json({
          success: true,
          message: "No courses created by this admin.",
          courses: [],
        });
      }

      // Extract course IDs from user's coursesCreated field
      const courseIds = user.coursesCreated.map((item: any) => item.courseId);

      // Fetch course details from MongoDB using course IDs
      const courses = await CourseModel.find({
        _id: { $in: courseIds },
      }).exec();

      // Cache the result in Redis for faster access next time
      await redis.set("allCourses", JSON.stringify(courses), "EX", 3600);

      return res.status(200).json({
        success: true,
        courses,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

//Delete Course -- only for admin
export const deleteCourse = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const course = await CourseModel.findById(id);
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }
      await course?.deleteOne({ id });
      await redis.del(id);
      res.status(200).json({
        status: "success",
        message: " Course removed successfully",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

export const toggleCoursePublic = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params; // Course ID from request parameters

      // Find the course in the database
      const course = await CourseModel.findById(id);

      // If course not found, throw an error
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      // Toggle the `isPublic` field
      course.isPublic = !course.isPublic || false;

      // Save the updated course document
      await course.save();

      // Optionally clear cached data for the course in Redis
      await redis.del(id);

      // Respond with the updated course state
      res.status(200).json({
        status: "success",
        message: `Course is now ${course.isPublic ? "public" : "private"}`,
        data: {
          courseId: id,
          isPublic: course.isPublic,
        },
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);
