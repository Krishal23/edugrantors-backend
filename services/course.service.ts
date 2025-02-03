import { Response } from "express";
import CourseModel from "../models/course.models";
import { CatchAsyncErrror } from "../middleware/catchAsyncError";
import userModel from "../models/user.model";
import ErrorHandler from "../utils/ErrorHandler";

//create course
export const createCourse =CatchAsyncErrror(async(data:any, res:Response )=>{
    const course:any =await CourseModel.create(data);

    if (data.teacher) {
        const teacher = await userModel.findById(data.teacher);
        if (!teacher) {
            return new ErrorHandler("Teacher not Found", 404);
        }
        // Push the created course ID to the teacher's coursesCreated array
        // teacher.coursesCreated.push({ courseId: course._id });
        // teacher.courses.push(course._id )
        teacher.coursesCreated.push({
            courseId: course._id,
            courseName: course.courseName,
          });
          
        teacher.courses.push({
            courseId: course._id,
            courseName: course.courseName,
          });
          
        await teacher.save();
    }
    res.status(201).json({
        success: true,
        course,
    });
});

//Get All Courses
export const getAlCoursesService = async (res: Response) => {
    const courses = await CourseModel.find().sort({createdAt:-1});
    res.status(201).json({
        success: true,
        courses
    });
}