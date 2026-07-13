import { clearGoogleToken, getGoogleToken } from "@/lib/googleAuth";

/** Primary calendar only: view events the signed-in user owns, never write. */
export const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.events.owned.readonly";

export function getCalendarToken(options: {
  interactive: boolean;
}): Promise<string | null> {
  return getGoogleToken({
    interactive: options.interactive,
    scopes: [GOOGLE_CALENDAR_SCOPE],
  });
}

export const clearCalendarToken = clearGoogleToken;
