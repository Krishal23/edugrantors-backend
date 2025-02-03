import { Document, Model } from "mongoose";

interface MonthData {
    month: string;
    count: number;
}
export async function generateLast12MonthData<T extends Document>(
    model: Model<T>
): Promise<{ last12Months: { month: string; count: number }[] }> {
    const last12Months: { month: string; count: number }[] = [];
    const currentDate = new Date();

    // Loop to generate data for each month starting from current month and going back 12 months
    for (let i = 0; i < 12; i++) {
        const endDate = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() - i + 1, // Increment month index
            1 // First day of next month
        );
        const startDate = new Date(
            endDate.getFullYear(),
            endDate.getMonth() - 1, // Previous month
            1 // First day of current month
        );

        // Format month and year as 'MMM YYYY'
        const monthYear = startDate.toLocaleString('default', {
            month: 'short',
            year: 'numeric',
        });

        const count = await model.countDocuments({
            createdAt: {
                $gte: startDate,
                $lt: endDate,
            },
        });

        last12Months.push({
            month: monthYear,
            count,
        });
    }

    return { last12Months };
}
