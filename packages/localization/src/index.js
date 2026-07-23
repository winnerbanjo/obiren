"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.COUNTRY_CONFIGURATIONS = void 0;
exports.getCountryConfig = getCountryConfig;
__exportStar(require("./emergencyDirectoryData"), exports);
exports.COUNTRY_CONFIGURATIONS = {
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
        disclaimer: "Obiren provides reproductive health tracking and safety tools under NDPR compliance. In an immediate medical emergency, contact 112 or your nearest hospital.",
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
        disclaimer: "Obiren features are localized for Ghana health guidance. In emergencies, reach 112 or local emergency services immediately.",
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
        disclaimer: "Obiren complies with UK GDPR standards. For medical emergencies call 999; for non-urgent NHS medical advice call 111.",
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
        disclaimer: "Obiren complies with US HIPAA privacy architecture. In case of life-threatening emergencies, dial 911.",
    },
};
function getCountryConfig(code) {
    return exports.COUNTRY_CONFIGURATIONS[code] || exports.COUNTRY_CONFIGURATIONS.GB;
}
//# sourceMappingURL=index.js.map