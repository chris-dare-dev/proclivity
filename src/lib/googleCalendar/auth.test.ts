import { afterEach, describe, expect, it, vi } from "vitest";
import { getCalendarToken, GOOGLE_CALENDAR_SCOPE } from "./auth";
import {
  getToken as getPhotosToken,
  GOOGLE_PHOTOS_SCOPE,
  revoke,
} from "@/lib/googlePhotos/auth";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Google Calendar OAuth scope", () => {
  it("requests only the owned-events read-only scope", async () => {
    let captured: Record<string, unknown> | undefined;
    vi.stubGlobal("chrome", {
      runtime: {},
      identity: {
        getAuthToken: (details: Record<string, unknown>) => {
          captured = details;
          return Promise.resolve({
            token: "calendar-token",
            grantedScopes: [GOOGLE_CALENDAR_SCOPE],
          });
        },
      },
    });

    await expect(getCalendarToken({ interactive: true })).resolves.toBe(
      "calendar-token",
    );
    expect(captured?.scopes).toEqual([GOOGLE_CALENDAR_SCOPE]);
    expect(GOOGLE_CALENDAR_SCOPE).toContain("readonly");
    expect(GOOGLE_CALENDAR_SCOPE).not.toBe(
      "https://www.googleapis.com/auth/calendar.events",
    );
  });

  it("rejects granular consent when the requested scope is withheld", async () => {
    vi.stubGlobal("chrome", {
      runtime: {},
      identity: {
        getAuthToken: () =>
          Promise.resolve({ token: "other-token", grantedScopes: [] }),
      },
    });

    await expect(getCalendarToken({ interactive: true })).rejects.toThrow(
      "permission was not granted",
    );
  });

  it("keeps the existing Photos consent request scoped to Photos", async () => {
    let captured: Record<string, unknown> | undefined;
    vi.stubGlobal("chrome", {
      runtime: {},
      identity: {
        getAuthToken: (details: Record<string, unknown>) => {
          captured = details;
          return Promise.resolve({
            token: "photos-token",
            grantedScopes: [GOOGLE_PHOTOS_SCOPE],
          });
        },
      },
    });

    await expect(getPhotosToken({ interactive: true })).resolves.toBe(
      "photos-token",
    );
    expect(captured?.scopes).toEqual([GOOGLE_PHOTOS_SCOPE]);
    expect(captured?.scopes).not.toContain(GOOGLE_CALENDAR_SCOPE);
  });

  it("does not report a failed account-wide revocation as success", async () => {
    let cleared = 0;
    vi.stubGlobal("chrome", {
      identity: {
        clearAllCachedAuthTokens: (callback: () => void) => {
          cleared += 1;
          callback();
        },
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(null, { status: 400 })),
      ),
    );

    await expect(revoke("bad-token")).rejects.toThrow(
      "rejected the access-revocation request",
    );
    expect(cleared).toBe(1);
  });
});
