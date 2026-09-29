/**
 * Lightweight, vendor-agnostic analytics event queue for Obiren.
 *
 * Events are buffered in order and mirrored onto `window.dataLayer` when a
 * real analytics provider is connected later. No cookies, no third parties,
 * no persistent identifiers — just product event names for future use.
 */

export type ObirenEvent =
  | "waitlist_page_view"
  | "waitlist_form_started"
  | "waitlist_joined"
  | "waitlist_error";

const QUEUE: Array<{ event: ObirenEvent; ts: number; props?: Record<string, unknown> }> = [];

export function track(event: ObirenEvent, props?: Record<string, unknown>): void {
  const entry = { event, ts: Date.now(), props };
  QUEUE.push(entry);

  if (typeof window !== "undefined") {
    const w = window as unknown as { dataLayer?: unknown[]; __obirenEvents?: unknown[] };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ event, ...props });
    w.__obirenEvents = w.__obirenEvents || [];
    w.__obirenEvents.push(entry);
  }

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.debug("[obiren:analytics]", event, props ?? {});
  }
}

export function getQueuedEvents(): ReadonlyArray<{ event: ObirenEvent; ts: number; props?: Record<string, unknown> }> {
  return QUEUE;
}
