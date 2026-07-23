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
    supportedLanguages: Array<{
        code: string;
        label: string;
    }>;
    features: {
        telehealthEnabled: boolean;
        trustedCircleEnabled: boolean;
        silentSosEnabled: boolean;
        healthVaultEnabled: boolean;
    };
    disclaimer: string;
}
export declare const COUNTRY_CONFIGURATIONS: Record<CountryCode, CountryConfig>;
export declare function getCountryConfig(code: CountryCode): CountryConfig;
