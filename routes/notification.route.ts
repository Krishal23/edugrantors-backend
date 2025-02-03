import express from "express";
import { authorizeRoles, isAuthenticated } from "../middleware/auth";
import { getNotification, updateNotificationStatus } from "../controllers/notification.controller";
import { updateAccessToken } from "../controllers/user.controller";

const notificationRoute =  express.Router();

notificationRoute.get(
    "/get-all-notifications",
    updateAccessToken,
    isAuthenticated,
    authorizeRoles("teacher"),
    getNotification
)
notificationRoute.put(
    "/update-notifications/:id",
    updateAccessToken,
    isAuthenticated,
    authorizeRoles("teacher"),
    updateNotificationStatus
)


export default notificationRoute;