import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

export interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  primary?: boolean;
}

export interface GoogleEvent {
  id: string;
  summary: string;
  description?: string | null;
  start: {
    dateTime?: string | null;
    date?: string | null;
    timeZone?: string | null;
  };
  end: {
    dateTime?: string | null;
    date?: string | null;
    timeZone?: string | null;
  };
  extendedProperties?: any;
  iCalUID?: string | null;
}

export interface GoogleWatchResponse {
  kind: string;
  id: string;
  resourceId: string;
  resourceUri: string;
  token: string;
  expiration: string;
}

export class GoogleCalendarProvider {
  private oauth2Client: OAuth2Client;
  private calendar = google.calendar("v3");

  constructor(
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    accessToken: string,
    refreshToken?: string
  ) {
    this.oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);

    if (accessToken) {
      this.oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    }
  }

  /**
   * Get the OAuth2 authorization URL for user consent
   */
  getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
      ],
      prompt: "consent", // Force consent screen on every auth to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForToken(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    return tokens;
  }

  /**
   * List all calendars for the authenticated user
   */
  async listCalendars(): Promise<GoogleCalendar[]> {
    try {
      const response = await this.calendar.calendarList.list({
        auth: this.oauth2Client,
        pageToken: undefined,
      });

      return (response.data.items || []).map((cal: any) => ({
        id: cal.id,
        summary: cal.summary,
        description: cal.description,
        backgroundColor: cal.backgroundColor,
        foregroundColor: cal.foregroundColor,
        primary: cal.primary,
      }));
    } catch (error) {
      console.error("Failed to list calendars:", error);
      throw error;
    }
  }

  /**
   * List events in a specific calendar (with pagination support)
   */
  async listEvents(
    calendarId: string,
    timeMin?: string,
    timeMax?: string
  ): Promise<GoogleEvent[]> {
    try {
      const allEvents: GoogleEvent[] = [];
      let pageToken: string | undefined;

      do {
        const response = await this.calendar.events.list({
          auth: this.oauth2Client,
          calendarId,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: "startTime",
          pageToken,
        });

        const events = (response.data.items || []).map((event: any) => ({
          id: event.id,
          summary: event.summary,
          description: event.description,
          start: event.start,
          end: event.end,
          extendedProperties: event.extendedProperties,
          iCalUID: event.iCalUID,
        }));

        allEvents.push(...events);
        pageToken = response.data.nextPageToken || undefined;
      } while (pageToken);

      return allEvents;
    } catch (error) {
      console.error(`Failed to list events for calendar ${calendarId}:`, error);
      throw error;
    }
  }

  /**
   * Create an event in a specific calendar
   */
  async createEvent(
    calendarId: string,
    event: {
      summary: string;
      description?: string;
      start: { dateTime?: string; date?: string; timeZone?: string };
      end: { dateTime?: string; date?: string; timeZone?: string };
      extendedProperties?: {
        private?: { [key: string]: string };
      };
      transparency?: "opaque" | "transparent";
      showAs?: "busy" | "free";
    }
  ): Promise<GoogleEvent> {
    try {
      const response = await this.calendar.events.insert({
        auth: this.oauth2Client,
        calendarId,
        requestBody: {
          ...event,
        },
      });

      return {
        id: response.data.id!,
        summary: response.data.summary!,
        description: response.data.description,
        start: response.data.start!,
        end: response.data.end!,
        extendedProperties: response.data.extendedProperties,
        iCalUID: response.data.iCalUID,
      };
    } catch (error) {
      console.error(`Failed to create event in calendar ${calendarId}:`, error);
      throw error;
    }
  }

  /**
   * Update an event in a specific calendar
   */
  async updateEvent(
    calendarId: string,
    eventId: string,
    event: Partial<GoogleEvent>
  ): Promise<GoogleEvent> {
    try {
      const response = await this.calendar.events.update({
        auth: this.oauth2Client,
        calendarId,
        eventId,
        requestBody: event,
      });

      return {
        id: response.data.id!,
        summary: response.data.summary!,
        description: response.data.description,
        start: response.data.start!,
        end: response.data.end!,
        extendedProperties: response.data.extendedProperties,
        iCalUID: response.data.iCalUID,
      };
    } catch (error) {
      console.error(
        `Failed to update event ${eventId} in calendar ${calendarId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Delete an event from a specific calendar
   */
  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    try {
      await this.calendar.events.delete({
        auth: this.oauth2Client,
        calendarId,
        eventId,
      });
    } catch (error) {
      console.error(
        `Failed to delete event ${eventId} from calendar ${calendarId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Set up push notifications (watch) for a calendar
   * Returns channel info needed to validate incoming notifications
   */
  async setupWatch(
    calendarId: string,
    webhookToken: string,
    webhookUrl: string
  ): Promise<GoogleWatchResponse> {
    try {
      // Sanitize calendar ID for use as webhook channel ID (Google requires [A-Za-z0-9\-_\+/=]+)
      const sanitizedCalendarId = calendarId.replace(/[^A-Za-z0-9\-_]/g, '-');

      const response = await this.calendar.events.watch({
        auth: this.oauth2Client,
        calendarId,
        requestBody: {
          id: `busyguard-${sanitizedCalendarId}-${Date.now()}`,
          type: "web_hook",
          address: webhookUrl,
          token: webhookToken,
        },
      });

      return {
        kind: response.data.kind!,
        id: response.data.id!,
        resourceId: response.data.resourceId!,
        resourceUri: response.data.resourceUri!,
        token: response.data.token!,
        expiration: response.data.expiration!,
      };
    } catch (error) {
      console.error(`Failed to set up watch for calendar ${calendarId}:`, error);
      throw error;
    }
  }

  /**
   * Stop watching a calendar
   */
  async stopWatch(
    calendarId: string,
    channelId: string,
    resourceId: string
  ): Promise<void> {
    try {
      await this.calendar.channels.stop({
        auth: this.oauth2Client,
        requestBody: {
          id: channelId,
          resourceId: resourceId,
        },
      });
    } catch (error) {
      console.error(
        `Failed to stop watch for calendar ${calendarId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get user profile info
   */
  async getUserProfile() {
    const people = google.people("v1");
    const response = await people.people.get({
      auth: this.oauth2Client,
      resourceName: "people/me",
      personFields: "emailAddresses,names",
    });

    return {
      email:
        response.data.emailAddresses?.[0]?.value ||
        response.data.emailAddresses?.[0]?.value,
      displayName: response.data.names?.[0]?.displayName,
    };
  }
}
