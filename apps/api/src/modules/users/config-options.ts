import { COUNTRY_CONFIGURATIONS } from '@obiren/localization';

/**
 * Product enum catalogue for mobile clients. Intake condition and consultation
 * choices are explicitly provisional and must be ratified by product/clinical.
 */
export function getConfigOptions() {
  return {
    version: '1.0.0',
    provisional: true,
    objectives: [
      { value: 'CYCLE_TRACKING', label: 'Cycle tracking' },
      { value: 'PREGNANCY', label: 'Pregnancy' },
      { value: 'FERTILITY', label: 'Fertility' },
      { value: 'GENERAL_WELLNESS', label: 'General wellness' },
    ],
    countries: Object.values(COUNTRY_CONFIGURATIONS).map(({ code, name, flag, currency, supportedLanguages }) => ({
      code,
      name,
      flag,
      currency,
      supportedLanguages,
    })),
    timeZones: ['Africa/Lagos', 'Africa/Accra'],
    languages: [
      { code: 'en', label: 'English' },
      { code: 'yo', label: 'Yorùbá' },
      { code: 'ig', label: 'Igbo' },
      { code: 'ha', label: 'Hausa' },
      { code: 'tw', label: 'Twi' },
    ],
    cycleSymptoms: ['cramps', 'headache', 'back_pain', 'bloating', 'breast_pain', 'acne', 'fatigue', 'nausea'],
    moods: ['calm', 'happy', 'low', 'anxious', 'irritable', 'energetic', 'overwhelmed'],
    conditions: [
      { value: 'pcos', label: 'PCOS' },
      { value: 'endometriosis', label: 'Endometriosis' },
      { value: 'fibroids', label: 'Fibroids' },
      { value: 'none', label: 'None of the above' },
      { value: 'prefer_not_to_say', label: 'Prefer not to say' },
    ],
    consultationTypes: [
      { value: 'video', label: 'Video consultation' },
      { value: 'audio', label: 'Audio consultation' },
      { value: 'clinic', label: 'In-clinic consultation' },
    ],
    consentPurposes: [
      'terms_of_service_acknowledgement',
      'privacy_notice_acknowledgement',
      'health_data_processing',
      'care_communications',
      'health_sharing',
      'location_sharing',
      'marketing',
    ],
  };
}
