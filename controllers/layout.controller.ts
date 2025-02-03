import { NextFunction, Request, Response } from "express";
import { CatchAsyncErrror } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import LayoutModel from "../models/layout.models";
import cloudinary from 'cloudinary';

//create Layout
export const createLayout = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { type } = req.body;
        const isTypeExist = await LayoutModel.findOne({ type });
        if (isTypeExist) {
            return next(new ErrorHandler(`Layout type  ${type} already exist`, 400));
        }

        if (type === "Banner") {
            const { image, title, subTitle } = req.body;
            const myCLoud = await cloudinary.v2.uploader.upload(image, {
                folder: 'layout',
            });

            const banner = {
                image: {
                    public_id: myCLoud.public_id,
                    url: myCLoud.secure_url
                },
                title: title,
                subTitle: subTitle,
            }
            await LayoutModel.create(banner);
        }
        if (type === "FAQ") {
            const { faq } = req.body;
            const faqItems = await Promise.all(
                faq.map(async (item: any) => {
                    return {
                        question: item.question,
                        answer: item.answer
                    }
                })
            );
            await LayoutModel.create({ type: "FAQ", faq: faqItems });
        }

        if (type === "Categories") {
            const { categories } = req.body;
            const categoriesItems = await Promise.all(
                categories.map(async (item: any) => {
                    return {
                        title: item.title,
                    }
                })
            );
            await LayoutModel.create({ type: "Categories", categories: categoriesItems });
        }

        res.status(200).json({
            success: 'true',
            message: 'Layout created successfully',

        });



    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

//Edit Layout
export const editLayout = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { type } = req.body;
        if (type === "Banner") {
            const bannerData: any = await LayoutModel.findOne({ type: "Banner" });
            const { image, title, subTitle } = req.body;
            if (bannerData) {
                await cloudinary.v2.uploader.destroy(bannerData.image.public_id);
            }
            const myCloud = await cloudinary.v2.uploader.upload(image, {
                folder: "layout",
            });
            const banner = {
                type: "Banner",
                image: {
                    public_id: myCloud.public_id,
                    url: myCloud.secure_url
                },
                title: title,
                subTitle: subTitle,
            }
            await LayoutModel.findByIdAndUpdate(bannerData.id, { banner });
        }
        if (type === "FAQ") {
            const { faq } = req.body;
            const FaqItem = await LayoutModel.findOne({ type: "FAQ" });
            const faqItems = await Promise.all(
                faq.map(async (item: any) => {
                    return {
                        question: item.question,
                        answer: item.answer
                    }
                })
            );
            await LayoutModel.findByIdAndUpdate(FaqItem?._id, { type: "FAQ", faq: faqItems });
        }

        if (type === "Categories") {
            const { categories } = req.body;
            const categoriesData = await LayoutModel.findOne({ type: "Categories" });
            const categoriesItems = await Promise.all(
                categories.map(async (item: any) => {
                    return {
                        title: item.title,
                    }
                })
            );
            await LayoutModel.findByIdAndUpdate(categoriesData?._id, { type: "Categories", categories: categoriesItems });
        }

        res.status(200).json({
            success: 'true',
            message: 'Layout updated successfully',

        });



    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

//get layout by type
export const getLayoutByType = CatchAsyncErrror(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const layout = await LayoutModel.findOne({type: req.body.type});
        if (!layout) {
            return next(  new ErrorHandler('Layout not found', 404));
        }
        res.status(201).json({
            success: true,
            layout
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});
