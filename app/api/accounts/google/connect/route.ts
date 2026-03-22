import { NextRequest, NextResponse } from "next/server";
import { GoogleCalendarProvider } from "@/lib/providers/google";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json(
        { error: "Google OAuth credentials not configured" },
        { status: 500 }
      );
    }

    // Create OAuth provider instance (tokens not needed for auth URL)
    const provider = new GoogleCalendarProvider(
      clientId!,
      clientSecret!,
      redirectUri!,
      "" // Empty token for auth URL generation
    );

    // Get the authorization URL
    const authUrl = provider.getAuthUrl();

    // Store the state in the session/cookie for validation on callback
    const response = NextResponse.redirect(authUrl);

    // Set a secure cookie with state info for CSRF protection
    const state = Math.random().toString(36).substring(7);
    response.cookies.set("google_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60, // 10 minutes
    });

    return response;
  } catch (error) {
    logger.error("Error in Google OAuth connect", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to initiate Google OAuth" },
      { status: 500 }
    );
  }
}
