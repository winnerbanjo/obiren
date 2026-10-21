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
/**
 * Verification levels a published emergency-directory record can carry.
 * `source_verified` / `directory_source_verified` describe how the record was
 * compiled; `operationally_confirmed` is only ever set from a recorded staff
 * review that reached the provider itself.
 */
export type EmergencyVerificationStatus = "source_verified" | "directory_source_verified" | "operationally_confirmed" | "unverified";
export declare const EMERGENCY_DIRECTORY_DATASET_VERSION = "emergency-directory-v1.0.0";
/** Staff re-check cadence for published emergency resources, in days. */
export declare const EMERGENCY_RESOURCE_REVIEW_INTERVAL_DAYS = 180;
/** A resource is "due soon" when its next review falls inside this window. */
export declare const EMERGENCY_RESOURCE_DUE_SOON_DAYS = 30;
/**
 * Baseline status implied by the compiled dataset. "Source verified" means an
 * editor read the provider's published page; it does not mean the number was
 * called or that the provider confirmed current availability.
 */
export declare function normalizeEmergencyVerificationStatus(status: string): EmergencyVerificationStatus;
export declare const VERIFIED_EMERGENCY_DATASET: VerifiedEmergencyRecord[];
