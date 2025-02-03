import { NextFunction, Request, Response } from "express"

export const CatchAsyncErrror = (theFunc: any) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(theFunc(req, res, next)).catch(next)
}