/**
 * Support FAQ copy. Product and clinical review of this wording is still
 * pending, so every entry is returned with `reviewStatus: 'provisional'`.
 * None of this copy claims medical advice or guaranteed response times.
 */
export interface SupportFaq {
  slug: string;
  category: 'getting_started' | 'privacy' | 'care' | 'billing' | 'safety';
  question: string;
  answer: string;
  reviewStatus: 'provisional' | 'approved';
}

export const SUPPORT_FAQ_VERSION = 'support-faq-v1.0.0';

export const SUPPORT_FAQS: SupportFaq[] = [
  {
    slug: 'what-is-obiren',
    category: 'getting_started',
    question: 'What is Òbìrèn?',
    answer:
      'Òbìrèn is a reproductive-health tracking and support service. You can record cycles, daily symptoms and pregnancy progress, read health information, and request care from verified professionals. It is not a substitute for a clinician, and predictions are estimates rather than contraception or diagnosis.',
    reviewStatus: 'provisional',
  },
  {
    slug: 'cycle-prediction-accuracy',
    category: 'getting_started',
    question: 'How accurate are my cycle predictions?',
    answer:
      'Predictions are calculated from the periods you record and are shown with a confidence level and a date range. Irregular cycles, illness and stress change timing, so a prediction is not a guarantee and must not be used as contraception.',
    reviewStatus: 'provisional',
  },
  {
    slug: 'who-can-see-my-data',
    category: 'privacy',
    question: 'Who can see my health data?',
    answer:
      'Your cycle, symptom and pregnancy records belong to your account. They are only shared when you create a time-limited health share or when you message a care professional in a consultation you are part of. You can revoke a share at any time.',
    reviewStatus: 'provisional',
  },
  {
    slug: 'export-or-delete-account',
    category: 'privacy',
    question: 'Can I export or delete my account data?',
    answer:
      'Yes. You can export your data from account settings, and you can request deletion. Deletion is scheduled with a cancellation window; erasure is then carried out by our operations team under the documented retention rules, which may require keeping limited records such as payment receipts where the law requires it.',
    reviewStatus: 'provisional',
  },
  {
    slug: 'how-bookings-work',
    category: 'care',
    question: 'How does booking a professional work?',
    answer:
      'You hold an available slot, review the quoted price, and then pay through the payment provider. A booking is only confirmed after the provider verifies the payment; a hold or an unpaid booking is not an appointment. Refunds follow the published cancellation policy once it is approved.',
    reviewStatus: 'provisional',
  },
  {
    slug: 'emergency-numbers',
    category: 'safety',
    question: 'Can Òbìrèn call emergency services for me?',
    answer:
      'No. The SOS feature records an incident and can notify trusted contacts when a delivery channel is configured, but it does not dispatch emergency services and cannot guarantee that anyone responds. In an immediate emergency, call your local emergency number. The verified-resource directory lists numbers you can call yourself.',
    reviewStatus: 'provisional',
  },
  {
    slug: 'trusted-contacts',
    category: 'safety',
    question: 'What can a trusted contact see?',
    answer:
      'A trusted contact only receives the alert you authorise, limited to the scopes you grant (SOS alerts or check-ins). They do not get access to your cycle, symptom or pregnancy records.',
    reviewStatus: 'provisional',
  },
  {
    slug: 'payment-refunds',
    category: 'billing',
    question: 'How do refunds work?',
    answer:
      'Paid sessions can be cancelled before they start. Until the refund policy is approved and published, a cancelled paid booking is marked as pending policy rather than pretending a refund has been issued, and our team follows up directly.',
    reviewStatus: 'provisional',
  },
];
