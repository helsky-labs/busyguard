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
  console.log(`Found ${accounts.length} accounts\n`);

  if (accounts.length === 0) {
    console.log('No accounts found. Please reconnect an account first.');
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
      const calendarList = await calendar.calendarList.list({
        auth: oauth2Client,
      });

      for (const cal of calendarList.data.items || []) {
        try {
          console.log(`Scanning ${cal.summary}...`);

          // List all events from the last 7 days
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const events = await calendar.events.list({
            auth: oauth2Client,
            calendarId: cal.id,
            timeMin: sevenDaysAgo,
            maxResults: 2500,
            showDeleted: false,
          });

          let deleted = 0;
          const eventList = events.data.items || [];

          for (let idx = 0; idx < eventList.length; idx++) {
            const event = eventList[idx];
            // Add 10ms delay between deletes to avoid rate limit
            if (idx > 0) {
              await new Promise(resolve => setTimeout(resolve, 10));
            }
            // Delete if: no summary, summary is empty, has busyguard property, or summary is "Busy"
            const hasBusyguardProp = event.extendedProperties?.private?.busyguard === 'managed';
            const noTitle = !event.summary || event.summary.trim() === '';
            const isBusy = event.summary === 'Busy';

            if (hasBusyguardProp || noTitle || isBusy) {
              try {
                await calendar.events.delete({
                  auth: oauth2Client,
                  calendarId: cal.id,
                  eventId: event.id,
                });
                deleted++;
                if (deleted % 100 === 0) {
                  console.log(`  Deleted ${deleted} events...`);
                }
              } catch (e) {
                if (e.message.includes('410')) {
                  // Already deleted, skip
                  deleted++;
                } else if (e.message.includes('429') || e.message.includes('Rate Limit')) {
                  console.log(`\n  Hit rate limit at ${deleted} deleted. Waiting 60s...`);
                  await new Promise(resolve => setTimeout(resolve, 60000));
                } else {
                  // Log error but continue
                }
              }
            }
          }

          if (deleted > 0) {
            console.log(`✓ Deleted ${deleted} events from ${cal.summary}\n`);
          } else {
            console.log(`✓ No duplicates found in ${cal.summary}\n`);
          }
        } catch (e) {
          console.error(`Error processing calendar ${cal.summary}:`, e.message);
        }
      }
    } catch (e) {
      console.error(`Error listing calendars for ${account.email}:`, e.message);
    }
  }

  // Clear database
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/managed_busy_blocks?id=is.not.null`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
      }
    );
    console.log('✓ Cleared managed_busy_blocks table');
  } catch (e) {
    console.error('Failed to clear database:', e.message);
  }

  console.log('\n✓ Cleanup complete');
}

cleanup().catch(console.error);
