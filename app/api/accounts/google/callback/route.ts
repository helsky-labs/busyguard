import { NextRequest, NextResponse } from "next/server";
import { GoogleCalendarProvider } from "@/lib/providers/google";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { serverEnv, publicEnv } from "@/lib/env";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const returnedState = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.json(
        { error: `Google OAuth error: ${error}` },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: "Missing authorization code" },
        { status: 400 }
      );
    }

    // Validate CSRF state
    const storedState = request.cookies.get("google_oauth_state")?.value;
    if (!storedState || !returnedState || storedState !== returnedState) {
      logger.warn("OAuth state mismatch", {
        hasStoredState: !!storedState,
        hasReturnedState: !!returnedState,
      });
      return NextResponse.json(
        { error: "Invalid OAuth state — possible CSRF attack" },
        { status: 403 }
      );
    }

    // Get Supabase client and user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }

    // Exchange code for tokens
    const provider = new GoogleCalendarProvider(
      serverEnv.GOOGLE_CLIENT_ID,
      serverEnv.GOOGLE_CLIENT_SECRET,
      serverEnv.GOOGLE_REDIRECT_URI,
      "" // Will set after token exchange
    );

    const tokens = await provider.exchangeCodeForToken(code);

    if (!tokens.access_token) {
      return NextResponse.json(
        { error: "Failed to obtain access token" },
        { status: 400 }
      );
    }

    // Create a new provider with the obtained tokens
    const authenticatedProvider = new GoogleCalendarProvider(
      serverEnv.GOOGLE_CLIENT_ID,
      serverEnv.GOOGLE_CLIENT_SECRET,
      serverEnv.GOOGLE_REDIRECT_URI,
      tokens.access_token,
      tokens.refresh_token ?? undefined
    );

    // Get user profile and calendars
    const profile = await authenticatedProvider.getUserProfile();
    const calendarsList = await authenticatedProvider.listCalendars();

    // Store calendar account in Supabase
    const { data: account, error: accountError } = await supabase
      .from("calendar_accounts")
      .insert({
        user_id: user.id,
        provider: "google",
        provider_account_id: profile.email,
        email: profile.email,
        display_name: profile.displayName,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
      })
      .select()
      .single();

    if (accountError) {
      logger.error("Failed to store calendar account", {
        error: accountError.message,
      });
      return NextResponse.json(
        { error: "Failed to store calendar account" },
        { status: 500 }
      );
    }

    // Store calendars in Supabase
    const calendarsToInsert = calendarsList.map((cal) => ({
      account_id: account.id,
      user_id: user.id,
      provider_calendar_id: cal.id,
      name: cal.summary,
      color: cal.backgroundColor,
      is_included: cal.primary ?? false, // Only include primary calendar by default
    }));

    const insertedCalendars = [];

    if (calendarsToInsert.length > 0) {
      const { data: calendarsData, error: calendarsError } = await supabase
        .from("calendars")
        .insert(calendarsToInsert)
        .select();

      if (calendarsError) {
        logger.error("Failed to store calendars", {
          error: calendarsError.message,
        });
        // Don't fail entirely if calendars can't be stored - account is created
      } else if (calendarsData) {
        insertedCalendars.push(...calendarsData);
      }
    }

    // Set up watches for included calendars
    const webhookUrl = `${publicEnv.APP_URL}/api/webhooks/google`;
    const webhookToken = serverEnv.GOOGLE_WEBHOOK_TOKEN;

    if (insertedCalendars.length > 0) {
      for (const cal of insertedCalendars) {
        if (!cal.is_included) continue;

        try {
          const watch = await authenticatedProvider.setupWatch(
            cal.provider_calendar_id,
            webhookToken,
            webhookUrl
          );

          // Store webhook channel
          await supabase.from("webhook_channels").insert({
            calendar_id: cal.id,
            provider: "google",
            channel_id: watch.id,
            resource_id: watch.resourceId,
            expiry: new Date(parseInt(watch.expiration)).toISOString(),
          });
        } catch (watchError) {
          logger.error("Failed to set up watch for calendar", {
            calendarId: cal.provider_calendar_id,
            error:
              watchError instanceof Error
                ? watchError.message
                : String(watchError),
          });
        }
      }
    }

    // Initial sync will be triggered by the webhook watch notification
    // or by the user hitting the manual sync endpoint.
    // Fire-and-forget doesn't work on Vercel — the function gets killed
    // after sending the redirect, leaving orphaned sync locks.

    // Clear OAuth state cookie and redirect
    const redirectResponse = NextResponse.redirect(
      new URL("/dashboard/accounts?connected=google", request.url)
    );
    redirectResponse.cookies.delete("google_oauth_state");
    return redirectResponse;
  } catch (error) {
    logger.error("Error in Google OAuth callback", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to complete Google OAuth" },
      { status: 500 }
    );
  }
}
