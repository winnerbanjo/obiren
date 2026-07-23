"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateCyclePrediction = calculateCyclePrediction;
function calculateCyclePrediction(input) {
    const { userId, confirmedCycles, statedAverageCycleLength = 28 } = input;
    const sortedCycles = [...confirmedCycles].sort((a, b) => new Date(b.periodStartDate).getTime() - new Date(a.periodStartDate).getTime());
    let averageCycleDays = statedAverageCycleLength;
    let confidence = "LOW";
    let explanationCode = "INSUFFICIENT_DATA";
    if (sortedCycles.length === 0) {
        averageCycleDays = statedAverageCycleLength;
        confidence = "LOW";
        explanationCode = "INSUFFICIENT_DATA";
    }
    else if (sortedCycles.length === 1) {
        averageCycleDays = statedAverageCycleLength;
        confidence = "LOW";
        explanationCode = "INSUFFICIENT_DATA";
    }
    else {
        const cycleLengths = [];
        for (let i = 0; i < sortedCycles.length - 1; i++) {
            const currentStart = new Date(sortedCycles[i].periodStartDate).getTime();
            const prevStart = new Date(sortedCycles[i + 1].periodStartDate).getTime();
            const diffDays = Math.round((currentStart - prevStart) / (1000 * 60 * 60 * 24));
            if (diffDays >= 20 && diffDays <= 45) {
                cycleLengths.push(diffDays);
            }
        }
        if (cycleLengths.length >= 1) {
            let weightedSum = 0;
            let totalWeight = 0;
            const weights = [3, 2.5, 2, 1.5, 1];
            cycleLengths.slice(0, 5).forEach((len, idx) => {
                const w = weights[idx] || 1;
                weightedSum += len * w;
                totalWeight += w;
            });
            averageCycleDays = Math.round(weightedSum / totalWeight);
            const minLength = Math.min(...cycleLengths);
            const maxLength = Math.max(...cycleLengths);
            const variation = maxLength - minLength;
            if (cycleLengths.length >= 5 && variation <= 3) {
                confidence = "HIGH";
                explanationCode = "REGULAR_HISTORY";
            }
            else if (cycleLengths.length >= 3 && variation <= 6) {
                confidence = "MEDIUM";
                explanationCode = "MODERATE_VARIATION";
            }
            else {
                confidence = "LOW";
                explanationCode = "MODERATE_VARIATION";
            }
        }
    }
    const lastPeriodStart = sortedCycles.length > 0
        ? new Date(sortedCycles[0].periodStartDate)
        : new Date();
    const nextStartDate = new Date(lastPeriodStart);
    nextStartDate.setDate(nextStartDate.getDate() + averageCycleDays);
    const nextEndDate = new Date(nextStartDate);
    nextEndDate.setDate(nextEndDate.getDate() + 5);
    const rangeMargin = confidence === "HIGH" ? 2 : confidence === "MEDIUM" ? 3 : 5;
    const rangeStart = new Date(nextStartDate);
    rangeStart.setDate(rangeStart.getDate() - rangeMargin);
    const rangeEnd = new Date(nextStartDate);
    rangeEnd.setDate(rangeEnd.getDate() + rangeMargin);
    const estimatedOvulationDate = new Date(nextStartDate);
    estimatedOvulationDate.setDate(estimatedOvulationDate.getDate() - 14);
    const estimatedFertileWindowStart = new Date(estimatedOvulationDate);
    estimatedFertileWindowStart.setDate(estimatedFertileWindowStart.getDate() - 5);
    const estimatedFertileWindowEnd = new Date(estimatedOvulationDate);
    estimatedFertileWindowEnd.setDate(estimatedFertileWindowEnd.getDate() + 1);
    const formatDate = (d) => d.toISOString().split("T")[0];
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
//# sourceMappingURL=index.js.map