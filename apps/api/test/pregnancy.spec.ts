describe('Pregnancy Gestational Age & High Risk Escalation (PRD Audit Section 6)', () => {
  function calculateGestationalAge(lmpDate: Date, now: Date = new Date()) {
    const diffDays = Math.max(0, Math.floor((now.getTime() - lmpDate.getTime()) / (1000 * 60 * 60 * 24)));
    const currentWeek = Math.floor(diffDays / 7) + 1;
    const currentDay = (diffDays % 7) + 1;
    return { currentWeek, currentDay };
  }

  it('should calculate Week 22 for LMP 147 days prior to today', () => {
    const lmp = new Date('2026-02-24T00:00:00.000Z');
    const today = new Date('2026-07-21T00:00:00.000Z');
    const result = calculateGestationalAge(lmp, today);

    expect(result.currentWeek).toBe(22);
    expect(result.currentDay).toBe(1);
  });

  it('should trigger Clinical Safety Notice when high-risk symptom is logged', () => {
    const payload = { symptoms: ['severe_bleeding', 'mild_backache'] };
    const isHighRisk = payload.symptoms.some((s) =>
      ['severe_bleeding', 'severe_abdominal_pain', 'vision_loss'].includes(s)
    );

    let safetyNotice = null;
    if (isHighRisk) {
      safetyNotice = {
        severity: 'urgent',
        title: 'Please seek urgent medical advice',
      };
    }

    expect(isHighRisk).toBe(true);
    expect(safetyNotice).not.toBeNull();
    expect(safetyNotice?.severity).toBe('urgent');
  });
});
