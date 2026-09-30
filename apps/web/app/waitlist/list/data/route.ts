import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Data feed for the password-gated /waitlist/list page. Runs server-side so
 * the shared list key never reaches the browser, and is itself protected by
 * middleware (same cookie as the page).
 */
export async function GET() {
  const base = process.env.API_PROXY_TARGET;
  const key = process.env.WAITLIST_LIST_PASSWORD;

  if (!base || !key) {
    return NextResponse.json(
      { success: false, error: "Private view not configured" },
      { status: 503 },
    );
  }

  try {
    const upstream = await fetch(`${base}/api/v1/waitlist/preview?format=json`, {
      headers: { "x-list-key": key },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { success: false, error: `Upstream responded ${upstream.status}` },
        { status: 502 },
      );
    }

    return NextResponse.json(await upstream.json(), {
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Could not reach the API" },
      { status: 502 },
    );
  }
}
