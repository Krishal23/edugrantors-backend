import express, { Request, Response, Router } from 'express';
import { activateUser, changeForgotPassword, deleteUser, getAllUsers, getEnrolledCourses, getEnrolledUsers, getUserInfo, getUserInfoAdmin, loginUser, logoutUser, registerUser, sendOTPVerifyMail, socialAuth, unEnrollUser, updateAccessToken, updatePassword, updateProfilePicture, updateUserInfo, updateUserRole, userExist } from '../controllers/user.controller';
import { authorizeRoles, isAuthenticated } from '../middleware/auth';

// Create an instance of the router
const userRouter = express.Router();

// Define the route for registration
userRouter.post('/registration', registerUser);
userRouter.post('/activate-user', activateUser);
userRouter.post('/login', loginUser);
userRouter.get('/logout', isAuthenticated, logoutUser);
userRouter.get('/refresh-token',updateAccessToken);
userRouter.get('/me',updateAccessToken,isAuthenticated, getUserInfo);
userRouter.post('/social-auth', socialAuth);
userRouter.put('/update-user-info', isAuthenticated,  updateUserInfo);
userRouter.put('/update-user-password', isAuthenticated, updatePassword);
userRouter.put('/update-user-avatar', isAuthenticated, updateProfilePicture);
userRouter.get('/get-users', isAuthenticated, authorizeRoles("admin"),getAllUsers);
userRouter.get('/get-user/:id', isAuthenticated, authorizeRoles("teacher"),getUserInfoAdmin);
userRouter.put('/update-user', isAuthenticated, authorizeRoles("teacher"),updateUserRole);
userRouter.put('/delete-user/:id', isAuthenticated, authorizeRoles("teacher"),deleteUser);
userRouter.put('/unenroll-user', isAuthenticated, authorizeRoles("teacher"),unEnrollUser);
userRouter.get('/enrolled-users/:id', updateAccessToken, isAuthenticated, authorizeRoles("teacher"),getEnrolledUsers);
userRouter.get('/enrolled-courses', updateAccessToken, isAuthenticated,getEnrolledCourses);
userRouter.post('/sent-verification-mail',sendOTPVerifyMail);
userRouter.put('/user-exist',userExist);
userRouter.post('/forgot-password',changeForgotPassword);

export default userRouter;
