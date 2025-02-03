// db.ts
import mongoose from 'mongoose';
import { setTimeout } from 'timers/promises';
import dotenv from 'dotenv';

dotenv.config();  // Load environment variables from .env file

const dbUrl: string = process.env.DB_URL || '';

const connectDB = async (): Promise<void> => {
    try {
        // Ensure dbUrl is not empty
        if (!dbUrl) {
            throw new Error('Database URL is missing or invalid');
        }

        // Connect to MongoDB
        const data = await mongoose.connect(dbUrl);


    } catch (error: any) {
        console.error(`Error connecting to the database: ${error.message}`);

        // Retry connection after a delay
        await setTimeout(5000); // Wait for 5 seconds before retrying
        await connectDB(); // Retry connecting to the database
    }
};

// Default export
export default connectDB;
