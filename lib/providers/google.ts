import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { logger } from '@/lib/logger';
import { serverEnv } from '@/lib/env';
import type { ExtendedProperties } from '@/lib/types';

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
  extendedProperties?: ExtendedProperties;
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
  getAuthUrl(state?: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
      ],
      prompt: "consent", // Force consent screen on every auth to get refresh token
      ...(state && { state }),
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

      return (response.data.items || []).map((cal) => ({
        id: cal.id!,
        summary: cal.summary!,
        description: cal.description ?? undefined,
        backgroundColor: cal.backgroundColor ?? undefined,
        foregroundColor: cal.foregroundColor ?? undefined,
        primary: cal.primary ?? undefined,
      }));
    } catch (error) {
      logger.error('Failed to list calendars', { error: error instanceof Error ? error.message : String(error) });
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

        const events = (response.data.items || []).map((event) => ({
          id: event.id!,
          summary: event.summary ?? '',
          description: event.description,
          start: event.start!,
          end: event.end!,
          extendedProperties: event.extendedProperties as ExtendedProperties | undefined,
          iCalUID: event.iCalUID,
        }));

        allEvents.push(...events);
        pageToken = response.data.nextPageToken || undefined;
      } while (pageToken);

      return allEvents;
    } catch (error) {
      logger.error('Failed to list events for calendar', { calendarId, error: error instanceof Error ? error.message : String(error) });
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

      const eventId = response.data.id!;

      // Google Workspace may strip fields on insert — patch them back
      if (!response.data.summary || !response.data.extendedProperties) {
        await this.calendar.events.patch({
          auth: this.oauth2Client,
          calendarId,
          eventId,
          requestBody: {
            summary: event.summary,
            description: event.description,
            transparency: event.transparency,
            extendedProperties: event.extendedProperties,
          },
        });
      }

      return {
        id: eventId,
        summary: event.summary,
        description: event.description,
        start: response.data.start!,
        end: response.data.end!,
        extendedProperties: event.extendedProperties as ExtendedProperties | undefined,
        iCalUID: response.data.iCalUID,
      };
    } catch (error) {
      logger.error('Failed to create event in calendar', { calendarId, error: error instanceof Error ? error.message : String(error) });
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
        extendedProperties: response.data.extendedProperties as ExtendedProperties | undefined,
        iCalUID: response.data.iCalUID,
      };
    } catch (error) {
      logger.error('Failed to update event in calendar', { calendarId, eventId, error: error instanceof Error ? error.message : String(error) });
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
      logger.error('Failed to delete event from calendar', { calendarId, eventId, error: error instanceof Error ? error.message : String(error) });
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
      logger.error('Failed to set up watch for calendar', { calendarId, error: error instanceof Error ? error.message : String(error) });
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
      logger.error('Failed to stop watch for calendar', { calendarId, error: error instanceof Error ? error.message : String(error) });
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

/**
 * Factory: create a GoogleCalendarProvider from stored credentials.
 * Centralizes provider construction to avoid duplicating env var access.
 */
export function createGoogleProvider(
  accessToken: string,
  refreshToken?: string | null
): GoogleCalendarProvider {
  return new GoogleCalendarProvider(
    serverEnv.GOOGLE_CLIENT_ID,
    serverEnv.GOOGLE_CLIENT_SECRET,
    serverEnv.GOOGLE_REDIRECT_URI,
    accessToken,
    refreshToken ?? undefined
  )
}
