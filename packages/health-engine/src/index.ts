import { Cycle, CyclePrediction } from "@obiren/types";

export interface CyclePredictionInput {
  userId: string;
  confirmedCycles: Array<{
    periodStartDate: string; // YYYY-MM-DD
    periodEndDate?: string;
    cycleLengthDays?: number;
  }>;
  statedAverageCycleLength?: number;
}

/**
 * Pure calculation engine for versioned Menstrual Cycle predictions.
 * Applies weighted averaging on recent cycles, outlier exclusion, and confidence assessment.
 */
export function calculateCyclePrediction(input: CyclePredictionInput): CyclePrediction {
  const { userId, confirmedCycles, statedAverageCycleLength = 28 } = input;

  // Filter valid cycles
  const sortedCycles = [...confirmedCycles].sort(
    (a, b) => new Date(b.periodStartDate).getTime() - new Date(a.periodStartDate).getTime()
  );

  let averageCycleDays = statedAverageCycleLength;
  let confidence: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  let explanationCode: "MODERATE_VARIATION" | "REGULAR_HISTORY" | "INSUFFICIENT_DATA" =
    "INSUFFICIENT_DATA";

  if (sortedCycles.length === 0) {
    // Default fallback
    averageCycleDays = statedAverageCycleLength;
    confidence = "LOW";
    explanationCode = "INSUFFICIENT_DATA";
  } else if (sortedCycles.length === 1) {
    averageCycleDays = statedAverageCycleLength;
    confidence = "LOW";
    explanationCode = "INSUFFICIENT_DATA";
  } else {
    // Calculate cycle lengths between consecutive period starts
    const cycleLengths: number[] = [];
    for (let i = 0; i < sortedCycles.length - 1; i++) {
      const currentStart = new Date(sortedCycles[i].periodStartDate).getTime();
      const prevStart = new Date(sortedCycles[i + 1].periodStartDate).getTime();
      const diffDays = Math.round((currentStart - prevStart) / (1000 * 60 * 60 * 24));
      
      // Exclude extreme outliers (<20 days or >45 days)
      if (diffDays >= 20 && diffDays <= 45) {
        cycleLengths.push(diffDays);
      }
    }

    if (cycleLengths.length >= 1) {
      // Apply weighted average: most recent cycle gets weight 3, previous 2, older 1
      let weightedSum = 0;
      let totalWeight = 0;
      const weights = [3, 2.5, 2, 1.5, 1];

      cycleLengths.slice(0, 5).forEach((len, idx) => {
        const w = weights[idx] || 1;
        weightedSum += len * w;
        totalWeight += w;
      });

      averageCycleDays = Math.round(weightedSum / totalWeight);

      // Determine variation / confidence
      const minLength = Math.min(...cycleLengths);
      const maxLength = Math.max(...cycleLengths);
      const variation = maxLength - minLength;

      if (cycleLengths.length >= 5 && variation <= 3) {
        confidence = "HIGH";
        explanationCode = "REGULAR_HISTORY";
      } else if (cycleLengths.length >= 3 && variation <= 6) {
        confidence = "MEDIUM";
        explanationCode = "MODERATE_VARIATION";
      } else {
        confidence = "LOW";
        explanationCode = "MODERATE_VARIATION";
      }
    }
  }

  // Calculate predicted dates based on most recent confirmed period start
  const lastPeriodStart = sortedCycles.length > 0
    ? new Date(sortedCycles[0].periodStartDate)
    : new Date();

  const nextStartDate = new Date(lastPeriodStart);
  nextStartDate.setDate(nextStartDate.getDate() + averageCycleDays);

  const nextEndDate = new Date(nextStartDate);
  nextEndDate.setDate(nextEndDate.getDate() + 5); // Assumed 5 days bleed

  // Range window (+/- 3 days for MEDIUM/HIGH, +/- 5 days for LOW)
  const rangeMargin = confidence === "HIGH" ? 2 : confidence === "MEDIUM" ? 3 : 5;
  const rangeStart = new Date(nextStartDate);
  rangeStart.setDate(rangeStart.getDate() - rangeMargin);

  const rangeEnd = new Date(nextStartDate);
  rangeEnd.setDate(rangeEnd.getDate() + rangeMargin);

  // Ovulation estimate (~14 days before next period start)
  const estimatedOvulationDate = new Date(nextStartDate);
  estimatedOvulationDate.setDate(estimatedOvulationDate.getDate() - 14);

  // Fertile window (5 days before ovulation to 1 day after)
  const estimatedFertileWindowStart = new Date(estimatedOvulationDate);
  estimatedFertileWindowStart.setDate(estimatedFertileWindowStart.getDate() - 5);

  const estimatedFertileWindowEnd = new Date(estimatedOvulationDate);
  estimatedFertileWindowEnd.setDate(estimatedFertileWindowEnd.getDate() + 1);

  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  return {
    userId,
    predictedStartDate: formatDate(nextStartDate),
    predictedEndDate: formatDate(nextEndDate),
    rangeStart: formatDate(rangeStart),
    rangeEnd: formatDate(rangeEnd),
    estimatedFertileWindowStart: formatDate(estimatedFertileWindowStart),
    estimatedFertileWindowEnd: formatDate(estimatedFertileWindowEnd),
    estimatedOvulationDate: formatDate(estimatedOvulationDate),
    confidence,
    calculationVersion: "health-engine-v1.0",
    explanationCode,
    generatedAt: new Date().toISOString(),
  };
}
