import { CountryCode } from "@obiren/types";

export * from "./emergencyDirectoryData";

export interface CountryConfig {
  code: CountryCode;
  name: string;
  flag: string;
  currency: {
    code: string;
    symbol: string;
  };
  emergencyNumbers: {
    medical: string;
    police: string;
    fire: string;
    domesticViolence?: string;
  };
  supportedLanguages: Array<{ code: string; label: string }>;
  features: {
    telehealthEnabled: boolean;
    trustedCircleEnabled: boolean;
    silentSosEnabled: boolean;
    healthVaultEnabled: boolean;
  };
  disclaimer: string;
}

export const COUNTRY_CONFIGURATIONS: Record<CountryCode, CountryConfig> = {
  NG: {
    code: "NG",
    name: "Nigeria",
    flag: "🇳🇬",
    currency: { code: "NGN", symbol: "₦" },
    emergencyNumbers: {
      medical: "112",
      police: "112",
      fire: "112",
      domesticViolence: "08003333333",
    },
    supportedLanguages: [
      { code: "en", label: "English" },
      { code: "yo", label: "Yorùbá" },
      { code: "ig", label: "Igbo" },
      { code: "ha", label: "Hausa" },
    ],
    features: {
      telehealthEnabled: true,
      trustedCircleEnabled: true,
      silentSosEnabled: true,
      healthVaultEnabled: true,
    },
    disclaimer:
      "Obiren provides reproductive health tracking and safety tools under NDPR compliance. In an immediate medical emergency, contact 112 or your nearest hospital.",
  },
  GH: {
    code: "GH",
    name: "Ghana",
    flag: "🇬🇭",
    currency: { code: "GHS", symbol: "₵" },
    emergencyNumbers: {
      medical: "112",
      police: "191",
      fire: "192",
      domesticViolence: "080010055",
    },
    supportedLanguages: [
      { code: "en", label: "English" },
      { code: "tw", label: "Twi" },
    ],
    features: {
      telehealthEnabled: true,
      trustedCircleEnabled: true,
      silentSosEnabled: true,
      healthVaultEnabled: true,
    },
    disclaimer:
      "Obiren features are localized for Ghana health guidance. In emergencies, reach 112 or local emergency services immediately.",
  },
  GB: {
    code: "GB",
    name: "United Kingdom",
    flag: "🇬🇧",
    currency: { code: "GBP", symbol: "£" },
    emergencyNumbers: {
      medical: "999",
      police: "999",
      fire: "999",
      domesticViolence: "08082000247",
    },
    supportedLanguages: [{ code: "en", label: "English" }],
    features: {
      telehealthEnabled: true,
      trustedCircleEnabled: true,
      silentSosEnabled: true,
      healthVaultEnabled: true,
    },
    disclaimer:
      "Obiren complies with UK GDPR standards. For medical emergencies call 999; for non-urgent NHS medical advice call 111.",
  },
  US: {
    code: "US",
    name: "United States",
    flag: "🇺🇸",
    currency: { code: "USD", symbol: "$" },
    emergencyNumbers: {
      medical: "911",
      police: "911",
      fire: "911",
      domesticViolence: "1-800-799-7233",
    },
    supportedLanguages: [
      { code: "en", label: "English" },
      { code: "es", label: "Español" },
    ],
    features: {
      telehealthEnabled: true,
      trustedCircleEnabled: true,
      silentSosEnabled: true,
      healthVaultEnabled: true,
    },
    disclaimer:
      "Obiren complies with US HIPAA privacy architecture. In case of life-threatening emergencies, dial 911.",
  },
};

export function getCountryConfig(code: CountryCode): CountryConfig {
  return COUNTRY_CONFIGURATIONS[code] || COUNTRY_CONFIGURATIONS.GB;
}
