import { Mode } from "fs";
import mongoose, { Document, Schema, Model } from "mongoose";

export interface INotfication extends Document {
    title: string,
    message: string,
    status: string,
    userId: string,
}

const notificationSchema = new Schema<INotfication>({
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    status: {
        type: String,
        default: 'unread',
        required: true,
    }
}, { timestamps: true });

const NotificationModel: Model<INotfication> = mongoose.model('Notification', notificationSchema);

export default NotificationModel;
