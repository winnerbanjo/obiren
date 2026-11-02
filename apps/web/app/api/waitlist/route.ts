import { NextResponse } from "next/server";

// Simulated server-side storage for waitlist entries during app lifecycle
const waitlistEntries: Array<{
  email: string;
  market?: string;
  createdAt: string;
}> = [
  { email: "sarah.j@example.com", market: "UK", createdAt: "2026-07-01T10:00:00Z" },
  { email: "amara.k@example.com", market: "Nigeria", createdAt: "2026-07-05T14:30:00Z" },
  { email: "chloe.m@example.com", market: "US", createdAt: "2026-07-10T09:15:00Z" },
  { email: "akosua.a@example.com", market: "Ghana", createdAt: "2026-07-15T11:45:00Z" },
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, market } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { success: false, error: "Invalid email format. Please check and try again." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if already registered
    const existingIndex = waitlistEntries.findIndex(
      (entry) => entry.email.toLowerCase() === normalizedEmail
    );

    if (existingIndex !== -1) {
      return NextResponse.json(
        {
          success: true,
          alreadyJoined: true,
          message: "You're already on the waitlist! We'll reach out as soon as early access opens in your market.",
          position: existingIndex + 1240, // offset for social proof realistic count
        },
        { status: 200 }
      );
    }

    // Add entry
    waitlistEntries.push({
      email: normalizedEmail,
      market: market || "General",
      createdAt: new Date().toISOString(),
    });

    const currentPosition = 1240 + waitlistEntries.length;

    return NextResponse.json(
      {
        success: true,
        alreadyJoined: false,
        message: `Welcome to Obiren! You are #${currentPosition.toLocaleString()} on our early access priority list.`,
        position: currentPosition,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Waitlist submission error:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please try again in a moment." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    totalCount: 1240 + waitlistEntries.length,
    markets: ["United Kingdom", "United States", "Nigeria", "Ghana"],
  });
}
