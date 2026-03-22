import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const { accountId } = await request.json();

    if (!accountId) {
      return NextResponse.json(
        { error: "Account ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify the account belongs to the user
    const { data: account, error: fetchError } = await supabase
      .from("calendar_accounts")
      .select("id, user_id")
      .eq("id", accountId)
      .single();

    if (fetchError || !account || account.user_id !== user.id) {
      return NextResponse.json(
        { error: "Account not found or unauthorized" },
        { status: 404 }
      );
    }

    // Delete the account (cascades to calendars and webhook_channels via foreign keys)
    const { error: deleteError } = await supabase
      .from("calendar_accounts")
      .delete()
      .eq("id", accountId);

    if (deleteError) {
      logger.error("Failed to delete account", { error: deleteError.message });
      return NextResponse.json(
        { error: "Failed to disconnect account" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Error in disconnect", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to disconnect account" },
      { status: 500 }
    );
  }
}
