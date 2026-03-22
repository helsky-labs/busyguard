import { NextRequest, NextResponse } from "next/server";
import { GoogleCalendarProvider } from "@/lib/providers/google";
import { logger } from "@/lib/logger";
import { serverEnv } from "@/lib/env";

export async function GET(request: NextRequest) {
  try {
    // Create OAuth provider instance (tokens not needed for auth URL)
    const provider = new GoogleCalendarProvider(
      serverEnv.GOOGLE_CLIENT_ID,
      serverEnv.GOOGLE_CLIENT_SECRET,
      serverEnv.GOOGLE_REDIRECT_URI,
      "" // Empty token for auth URL generation
    );

    // Generate CSRF state token and pass to Google
    const state = crypto.randomUUID();
    const authUrl = provider.getAuthUrl(state);

    const response = NextResponse.redirect(authUrl);

    // Store state in cookie for validation on callback
    response.cookies.set("google_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60, // 10 minutes
    });

    return response;
  } catch (error) {
    logger.error("Error in Google OAuth connect", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to initiate Google OAuth" },
      { status: 500 }
    );
  }
}
