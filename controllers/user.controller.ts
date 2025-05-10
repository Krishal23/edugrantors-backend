import dotenv from "dotenv";
dotenv.config();

import { Request, Response, NextFunction } from "express";
import userModel from "../models/user.model";
import { IUser } from "../models/user.model";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncErrror } from "../middleware/catchAsyncError";
import jwt, { Secret } from "jsonwebtoken";
import ejs from "ejs";
import path from "path";
import sendMail from "../utils/sendMail";
import {
  accessTokenOptions,
  refreshTokenOptions,
  sendToken,
} from "../utils/jwt";
import { redis } from "../utils/redis";
import { JwtPayload } from "../middleware/auth";
import {
  getAllUserService,
  updateUserRoleService,
} from "../services/user.service";
import cloudinary from "cloudinary";
import { console } from "inspector";
import CourseModel from "../models/course.models";
import crypto from "crypto"; // For generating a random password

// Register user
interface IRegistrationbody {
  name: string;
  email: string;
  password: string;
  contactnumber: string;
  classes?: string;
  targetYear?: string;
  stream?: string;
  gender?: string;
  avator?: string;
}



export const registerUser = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        name,
        email,
        password,
        contactnumber,
        classes,
        targetYear,
        stream,
        gender,
      } = req.body;
      const isEmailExist = await userModel.findOne({ email });
      if (isEmailExist) {
        return next(new ErrorHandler("Email already exists", 400));
      }
      const user: IRegistrationbody = {
        name,
        email,
        password,
        contactnumber,
        classes,
        targetYear,
        stream,
        gender,
      };

      const activationToken = createActivationToken(user);
      const activationCode = activationToken.activationCode;

      const data = {
        user: {
          name: user.name,
        },

        activationCode: activationCode,
      };

      await ejs.renderFile(
        path.join(__dirname, "../mails/activation-mail.ejs"),
        data
      );
      try {
        await sendMail({
          email: user.email,
          subject: "Activate your account",
          template: "activation-mail.ejs",
          data,
        });

        res.status(201).json({
          success: true,
          message: `Please check your email to:${user.email} activate your account`,
          activationToken: activationToken.token,
        });
      } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

interface IActivationToken {
  token: string;
  activationCode: string;
}

export const createActivationToken = (user: any): IActivationToken => {
  const activationCode = Math.floor(1000 + Math.random() * 900).toString();

  const token = jwt.sign(
    {
      user,
      activationCode,
    },
    process.env.ACTIVATION_SECRET as Secret,
    {
      expiresIn: "5m",
    }
  );
  return {
    token,
    activationCode,
  };
};

//send OTP
export const sendOTPVerifyMail = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userName, userEmail }: any = req.body;
    const otp = Math.floor(1000 + Math.random() * 900).toString();
    const data = {
      user: {
        name: userName,
      },
      otp,
    };

    await ejs.renderFile(
      path.join(__dirname, "../mails/verify-mail.ejs"),
      data
    );
    try {
      await sendMail({
        email: userEmail,
        subject: "UPDATE PASSWORD: Verify your mail",
        template: "verify-mail.ejs",
        data,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }

    res.status(201).json({
      success: true,
      message: `Please check your email to:${userEmail} verify your account`,
      otp,
    });
  }
);

export const verifyOTPVerifyMail = CatchAsyncErrror(
  async (_req: Request, res: Response, _next: NextFunction) => {
    console.log("verifying mail");

    res.status(201).json({
      success: true,
    });
  }
);
export const userExist = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body as ILoginRequest;
      if (!email) {
        return next(new ErrorHandler("Please provide email and password", 400));
      }
      const user = await userModel.findOne({ email }).select("name");
      if (!user) {
        return next(new ErrorHandler("User does not exist.", 401));
      }
      res.status(201).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Activate user
interface IActivateRequest {
  activation_token: string;
  activation_code: string;
}

export const activateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { activation_token, activation_code } = req.body as IActivateRequest;
    const newUser: { user: IUser; activationCode: string } = jwt.verify(
      activation_token,
      process.env.ACTIVATION_SECRET as Secret
    ) as { user: IUser; activationCode: string };
    if (newUser.activationCode != activation_code) {
      return next(new ErrorHandler("Invalid activation code", 400));
    }
    const {
      name,
      email,
      password,
      contactnumber,
      classes,
      gender,
      stream,
      targetYear,
    } = newUser.user;
    const existUser = await userModel.findOne({ email });
    if (existUser) {
      return next(new ErrorHandler("Email already exists", 400));
    }
    const user = await userModel.create({
      name,
      email,
      password,
      contactnumber,
      classes,
      stream,
      targetYear,
      gender,
    });
    res.status(201).json({
      success: true,
      user,
      message: "User activated successfully",
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
};

// Login User
interface ILoginRequest {
  email: string;
  password: string;
}
export const loginUser = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as ILoginRequest;
      if (!email || !password) {
        return next(new ErrorHandler("Please provide email and password", 400));
      }
      const user = await userModel.findOne({ email }).select("+password");
      if (!user) {
        return next(new ErrorHandler("Invalid email or password", 401));
      }
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return next(new ErrorHandler("Invalid email or password", 401));
      }
      redis
        .ping()
        .then(() => {
          console.log("Redis connection is healthy.");
        })
        .catch((err) => {
          console.error("Error connecting to Redis:", err);
        });

      // Send tokens
      await sendToken(user, 200, res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Logout User
// Logout User
export const logoutUser = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Clear cookies
      res.clearCookie("access_token");
      res.clearCookie("refresh_token");

      // Invalidate the session in Redis
      if (req.user && req.user._id) {
        await redis.del(req.user._id.toString());
      }

      res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error: any) {
      return next(
        new ErrorHandler("Logout failed. Please try again later.", 500)
      );
    }
  }
);

////update access token
export const updateAccessToken = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refresh_Token = req.cookies.refresh_token;
      if (!refresh_Token) {
        return next(new ErrorHandler("Refresh token is missing", 401));
      }

      const decoded = jwt.verify(
        refresh_Token,
        process.env.REFRESH_TOKEN as string
      ) as JwtPayload;

      if (!decoded) {
        return next(new ErrorHandler("Could not refresh token", 400));
      }

      const session = await redis.get(decoded.userId as string);
      if (!session) {
        return next(
          new ErrorHandler("Please log in to access this resource", 401)
        );
      }

      const user = JSON.parse(session);
      // console.log(user)

      // Generate new tokens
      const accessToken = jwt.sign(
        { id: user._id },
        process.env.ACCESS_TOKEN as string,
        { expiresIn: "15m" }
      );
      const newRefreshToken = jwt.sign(
        { userId: user._id },
        process.env.REFRESH_TOKEN as string,
        { expiresIn: "3d" }
      );

      // Set cookies
      res.cookie("access_token", accessToken, accessTokenOptions);
      res.cookie("refresh_token", newRefreshToken, refreshTokenOptions);

      await redis.set(user._id.toString(), JSON.stringify(user), "EX", 604800); // Refresh session

      next();
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

async function getUserById(userId: string) {
  const user: any = await userModel.findById(userId); // Adjust this according to your data source
  if (!user) {
    throw new Error("User not found"); // Handle this according to your error handling logic
  }

  return user;
}
// Get user info
export const getUserInfo = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId: any = req.user?._id;

      // Fetch user data (this should not send a response)
      const user = await getUserById(userId); // Assuming this function returns user data instead of sending a response
      // console.log(user)
      // Send the response with user info
      return res.status(200).json({
        success: true,
        message: "User ID retrieved successfully",
        userId: userId,
        user: user, // Include user data if needed
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);
export const getUserInfoAdmin = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id: any = req.params.id;
      const user = await getUserById(id); // Assuming this function returns user data instead of sending a response

      // Send the response with user info
      return res.status(200).json({
        success: true,
        message: "User ID retrieved successfully",
        user: user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

interface ISocialAuthBody {
  email: string;
  name: string;
  avatar: string;
}

//social auth
export const socialAuth = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, name, avatar } = req.body as ISocialAuthBody;
      const user: any = await userModel.findOne({ email });
      if (!user) {
        const newUser = await userModel.create({ email, name, avatar });
        const password = generateRandomPassword(8);
        newUser.password = password;
        await newUser.save();
        const data = {
          user: {
            name,
          },
          newPassword: password,
        };
        try {
          await sendMail({
            email,
            subject: "NEW PASSWORD",
            template: "newpass-mail.ejs",
            data,
          });
        } catch (error: any) {
          return next(new ErrorHandler(error.message, 400));
        }
        await sendToken(newUser, 200, res);
      } else {
        await sendToken(user, 200, res);
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//update user info
export interface IUpdateUserInfo {
  name?: string;
  email?: string;
  contactNumber?: string;
  classes?: string;
  stream?: string;
  targetYear?: string;
  gender?: string;
}

export const updateUserInfo = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, contactNumber, classes, stream, targetYear, gender } =
        req.body as IUpdateUserInfo;
      const userId = req.user?._id;

      if (!userId) {
        return next(new ErrorHandler("User not authenticated", 401));
      }

      const user = await userModel.findById(userId);

      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      // Update fields if provided in the request body
      if (name) user.name = name;
      if (contactNumber) user.contactnumber = contactNumber;
      if (classes) user.classes = classes;
      if (stream) user.stream = stream;
      if (targetYear) user.targetYear = targetYear;
      if (gender) user.gender = gender;

      // Save the updated user
      await user.save();

      // Cache the updated user in Redis
      await redis.set(userId.toString(), JSON.stringify(user));

      res.status(200).json({
        success: true,
        message: "User information updated successfully",
        user,
      });
    } catch (error: any) {
      return next(
        new ErrorHandler(
          error.message || "Failed to update user information",
          400
        )
      );
    }
  }
);

//update user password
interface IUpdatePassword {
  oldPassword: string;
  newPassword: string;
}

export const updatePassword = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { oldPassword, newPassword } = req.body as IUpdatePassword;

      // Check if both old and new passwords are provided
      if (!oldPassword || !newPassword) {
        return next(
          new ErrorHandler("Please provide both old and new password", 400)
        );
      }

      // Find the user and include the password field
      const user: any = await userModel
        .findById(req.user?._id)
        .select("+password");

      // Ensure the user and password exist
      if (!user || !user.password) {
        return next(new ErrorHandler("Invalid user or password not set", 400));
      }

      // Check if the old password matches
      const isMatch = await user.comparePassword(oldPassword);
      if (!isMatch) {
        return next(new ErrorHandler("Old password is incorrect", 400));
      }

      // Update the password
      user.password = newPassword;
      await user.save(); // Automatically hashes the password due to pre-save middleware

      // Remove the password before saving to Redis
      const userToCache = { ...user.toObject() };
      delete userToCache.password; // Remove sensitive information

      // Update the user data in Redis
      await redis.set(req.user?._id as string, JSON.stringify(userToCache));

      // Send success response
      res.status(200).json({
        success: true,
        message: "Password updated successfully",
      });
    } catch (error: any) {
      // Catch any unexpected error and pass it to the error handler middleware
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

export const changeForgotPassword = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.body;
      // console.log(userId);

      // // Find the user and include the password field
      const user: any = await userModel.findById(userId).select("+password");

      // Ensure the user and password exist
      if (!user || !user.password) {
        return next(new ErrorHandler("Invalid user or password not set", 400));
      }

      const newPassword = generateRandomPassword(8);
      // console.log(newPassword);
      // Update the password
      user.password = newPassword;
      await user.save();
      // Remove the password before saving to Redis
      const userToCache = { ...user.toObject() };
      delete userToCache.password; // Remove sensitive information

      // Update the user data in Redis
      await redis.set(req.user?._id as string, JSON.stringify(userToCache));
      const data = {
        user: {
          name: user.name,
        },
        newPassword,
      };

      // const html = await ejs.renderFile(path.join(__dirname, "../mails/newpass-mail.ejs"), data);
      try {
        await sendMail({
          email: user.email,
          subject: "NEW PASSWORD",
          template: "newpass-mail.ejs",
          data,
        });
      } catch (error: any) {
        console.log(error);
        return next(new ErrorHandler(error.message, 400));
      }

      console.log("mail send successfully");
      // Send success response
      res.status(200).json({
        success: true,
        message: "Password updated susfccessfully",
      });
    } catch (error: any) {
      // Catch any unexpected error and pass it to the error handler middleware
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Function to generate a strong random password of a specified length
const generateRandomPassword = (length: number): string => {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length); // Generate a secure random index
    password += charset[randomIndex];
  }
  return password;
};

//update profilepicture
// interface IUpdateProfilePicture {
//   avatar: string;
// }

export const updateProfilePicture = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { avatar } = req.body;
      const userId: any = req?.user?._id;
      const user = await userModel.findById(userId);

      if (avatar && user) {
        if (user?.avatar.public_id) {
          //delete old image
          await cloudinary.v2.uploader.destroy(user?.avatar?.public_id);
          //uploading new image
          const myCloud = await cloudinary.v2.uploader.upload(avatar, {
            folder: "avatars",
            width: 150,
          });
          user.avatar = {
            public_id: myCloud?.public_id,
            url: myCloud?.secure_url,
          };
        } else {
          const myCloud = await cloudinary.v2.uploader.upload(avatar, {
            folder: "avatars",
            width: 150,
          });
          user.avatar = {
            public_id: myCloud?.public_id,
            url: myCloud?.secure_url,
          };
        }
      }
      await user?.save();
      await redis.set(userId, JSON.stringify(user));
      res.status(200).json({
        status: "success",
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//get all users --only for admin
export const getAllUsers = CatchAsyncErrror(
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      getAllUserService(res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//get user enrolled in courses --only for admin
export const getEnrolledUsers = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = req.params.id;
      const course = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }
      const enrolledUserIds = course.studentsEnrolled; // Array of user IDs

      // Fetch all user details for the enrolled users
      const enrolledUsers = await userModel.find({
        _id: { $in: enrolledUserIds },
      });

      res.status(200).json({
        status: "success",
        enrolledUsers,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//get user enrolled in courses --only for admin
export const getEnrolledCourses = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId: any = req?.user?._id;
      const user = await userModel.findById(userId);
      const enrolledCoursesId = user?.courses.map(
        (course: any) => course.courseId
      );

      const enrolledCourses = await CourseModel.find({
        _id: { $in: enrolledCoursesId },
      }).select("name _id");
      res.status(200).json({
        status: "success true",
        enrolledCourses,
        user,
        enrolledCoursesId,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//update user role --only for admin
export const updateUserRole = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, role } = req.body;

      updateUserRoleService(res, id, role);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//Delete User -- only for admin
export const deleteUser = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = await userModel.findById(id);
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }
      await user?.deleteOne({ id });
      await redis.del(id!);
      res.status(200).json({
        status: "success",
        message: " User removed successfully",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//Delete User -- only for admin
export const unEnrollUser = CatchAsyncErrror(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, courseId } = req.body;

      // Fetch the user from the database
      const user = await userModel.findById(userId);
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      // Fetch the course from the database
      const course = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      // Remove the course from the user's `courses` array
      user.courses = user.courses.filter(
        (course) => course?.courseId?.toString() !== courseId
      );

      // Save the updated user document
      await user.save();

      // Remove the user from the course's `studentsEnrolled` array
      course.studentsEnrolled = course.studentsEnrolled.filter(
        (id) => id.toString() !== userId
      );

      // Save the updated course document
      await course.save();

      // Optionally clear user data from Redis
      await redis.del(userId);

      res.status(200).json({
        status: "success",
        message: "User unenrolled from course successfully",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);
