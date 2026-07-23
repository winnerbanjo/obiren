import { CyclePrediction } from "@obiren/types";
export interface CyclePredictionInput {
    userId: string;
    confirmedCycles: Array<{
        periodStartDate: string;
        periodEndDate?: string;
        cycleLengthDays?: number;
    }>;
    statedAverageCycleLength?: number;
}
export declare function calculateCyclePrediction(input: CyclePredictionInput): CyclePrediction;
