export interface VerifiedEmergencyRecord {
    record_id: string;
    organisation_name: string;
    top_category: string;
    service_category: string;
    country: string;
    countryCode: "NG" | "GH" | "GB" | "US";
    region: string;
    city: string;
    phone: string;
    whatsapp_or_text: string;
    email: string;
    service_summary: string;
    hours: string;
    cost: string;
    organisation_type: string;
    verification_status: string;
    obiren_follow_up: string;
    source_url: string;
}
export declare const VERIFIED_EMERGENCY_DATASET: VerifiedEmergencyRecord[];
