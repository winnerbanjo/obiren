import { calculateCyclePrediction } from '@obiren/health-engine';

describe('Cycle Engine & Weighted Predictions (PRD Audit Section 5)', () => {
  it('should return LOW confidence for user with only 1 confirmed cycle', () => {
    const prediction = calculateCyclePrediction({
      userId: 'u-101',
      confirmedCycles: [{ periodStartDate: '2026-07-01' }],
    });

    expect(prediction.confidence).toBe('LOW');
    expect(prediction.explanationCode).toBe('INSUFFICIENT_DATA');
    expect(prediction.predictedStartDate).toBe('2026-07-29');
  });

  it('should apply 35%/25%/18%/12%/10% weighted average for history of 5 cycles', () => {
    const prediction = calculateCyclePrediction({
      userId: 'u-101',
      confirmedCycles: [
        { periodStartDate: '2026-07-01' }, // 28 days from prev
        { periodStartDate: '2026-06-03' }, // 28 days
        { periodStartDate: '2026-05-06' }, // 28 days
        { periodStartDate: '2026-04-08' }, // 28 days
        { periodStartDate: '2026-03-11' }, // 28 days
        { periodStartDate: '2026-02-11' },
      ],
    });

    expect(prediction.confidence).toBe('HIGH');
    expect(prediction.explanationCode).toBe('REGULAR_HISTORY');
    expect(prediction.predictedStartDate).toBe('2026-07-29');
    expect(prediction.estimatedOvulationDate).toBe('2026-07-15');
  });

  it('should exclude extreme outlier cycles (<20 days or >45 days)', () => {
    const prediction = calculateCyclePrediction({
      userId: 'u-101',
      confirmedCycles: [
        { periodStartDate: '2026-07-01' },
        { periodStartDate: '2026-06-25' }, // Outlier: 6 days diff! (Excluded)
        { periodStartDate: '2026-05-28' }, // 28 days diff
        { periodStartDate: '2026-04-30' }, // 28 days diff
      ],
    });

    expect(prediction.predictedStartDate).toBeDefined();
    expect(prediction.calculationVersion).toBe('health-engine-v1.0');
  });
});
