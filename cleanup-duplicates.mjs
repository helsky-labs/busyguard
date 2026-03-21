import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function getAccounts() {
  const res = await fetch(`${supabaseUrl}/rest/v1/calendar_accounts`, {
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey,
    },
  });
  return res.json();
}

async function cleanup() {
  const accounts = await getAccounts();
  console.log(`Found ${accounts.length} accounts`);

  if (accounts.length === 0) {
    console.log('No accounts found');
    return;
  }

  for (const account of accounts) {
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
    });

    const calendar = google.calendar('v3');

    try {
      // Get all calendars
      const calendarList = await calendar.calendarList.list({
        auth: oauth2Client,
      });

      for (const cal of calendarList.data.items || []) {
        try {
          // List all "Busy" events
          const events = await calendar.events.list({
            auth: oauth2Client,
            calendarId: cal.id,
            q: 'summary:"Busy"',
            maxResults: 2500,
          });

          let deleted = 0;
          for (const event of events.data.items || []) {
            try {
              await calendar.events.delete({
                auth: oauth2Client,
                calendarId: cal.id,
                eventId: event.id,
              });
              deleted++;
            } catch (e) {
              console.error(`Failed to delete event ${event.id}:`, e.message);
            }
          }

          if (deleted > 0) {
            console.log(`✓ Deleted ${deleted} "Busy" events from ${cal.summary}`);
          }
        } catch (e) {
          console.error(`Error processing calendar ${cal.summary}:`, e.message);
        }
      }
    } catch (e) {
      console.error(`Error listing calendars for account ${account.email}:`, e.message);
    }
  }

  // Clear database
  try {
    await fetch(`${supabaseUrl}/rest/v1/managed_busy_blocks`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: { neq: null } }),
    });
    console.log('✓ Cleared managed_busy_blocks table');
  } catch (e) {
    console.error('Failed to clear database:', e.message);
  }

  console.log('\n✓ Cleanup complete');
}

cleanup().catch(console.error);
