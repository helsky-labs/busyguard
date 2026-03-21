import { NextRequest, NextResponse } from "next/server";
import { GoogleCalendarProvider } from "@/lib/providers/google";
import { createClient } from "@/lib/supabase/server";
import { syncCalendars } from "@/lib/sync-engine";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
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

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    const webhookToken = process.env.GOOGLE_WEBHOOK_TOKEN;

    if (!clientId || !clientSecret || !redirectUri || !webhookToken) {
      return NextResponse.json(
        { error: "Google OAuth credentials not configured" },
        { status: 500 }
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
      clientId!,
      clientSecret!,
      redirectUri!,
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
      clientId!,
      clientSecret!,
      redirectUri!,
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
      console.error("Failed to store calendar account:", accountError);
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
        console.error("Failed to store calendars:", calendarsError);
        // Don't fail entirely if calendars can't be stored - account is created
      } else if (calendarsData) {
        insertedCalendars.push(...calendarsData);
      }
    }

    // Set up watches for included calendars
    let appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL;
      appUrl = vercelUrl ? `https://${vercelUrl.replace(/^https?:\/\//, '')}` : undefined;
    }
    const webhookUrl = `${appUrl}/api/webhooks/google`;

    if (webhookToken && insertedCalendars.length > 0) {
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
        } catch (error) {
          console.error(
            `Failed to set up watch for calendar ${cal.provider_calendar_id}:`,
            error
          );
          // Continue with other calendars on error
        }
      }
    }

    // Trigger initial sync (fire and forget - don't block redirect)
    syncCalendars(user.id).catch((error) => {
      console.error("Error during initial sync:", error);
    });

    // Redirect to dashboard/accounts page
    return NextResponse.redirect(
      new URL("/dashboard/accounts?connected=google", request.url)
    );
  } catch (error) {
    console.error("Error in Google OAuth callback:", error);
    return NextResponse.json(
      { error: "Failed to complete Google OAuth" },
      { status: 500 }
    );
  }
}
