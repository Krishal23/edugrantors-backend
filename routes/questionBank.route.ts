import express from 'express';
import { deleteQuestion, editQuestion, getAllQuestions, getQuestionsByCourse, getQuestionsBySubTopic, getQuestionsByTopic, uploadQuestion } from '../controllers/questionBank.controller';
import { updateAccessToken } from '../controllers/user.controller';
import { authorizeRoles, isAuthenticated } from '../middleware/auth';
const questionBankRouter = express.Router();

questionBankRouter.post(
    "/upload-question",
    updateAccessToken,
    isAuthenticated,
    authorizeRoles("teacher"),
    uploadQuestion
);

questionBankRouter.put(
    "/edit-question",
    updateAccessToken,
    isAuthenticated,
    authorizeRoles("teacher"),
    editQuestion
);
questionBankRouter.delete(
    "/delete-question/:questionId",
    updateAccessToken,
    isAuthenticated,
    authorizeRoles("teacher"),
    deleteQuestion
);
questionBankRouter.get(
    "/get-course-questions/:id",
    updateAccessToken,
    isAuthenticated,
    // authorizeRoles("teacher"),
    getQuestionsByCourse
);
questionBankRouter.get(
    "/get-all-questions",
    updateAccessToken,
    isAuthenticated,
    // authorizeRoles("teacher"),
    getAllQuestions
);
questionBankRouter.get(
    "/get-course-topic-questions",
    updateAccessToken,
    isAuthenticated,
    authorizeRoles("teacher"),
    getQuestionsByTopic
);
questionBankRouter.get(
    "/get-course-subTopic-questions",
    updateAccessToken,
    isAuthenticated,
    authorizeRoles("teacher"),
    getQuestionsBySubTopic
);


export default questionBankRouter;