import { Request } from "express";
import { IUser } from "../models/user.model";
import "ejs";
import "nodemailer";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}
