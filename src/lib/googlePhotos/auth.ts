/**
 * Google OAuth via `chrome.identity.getAuthToken`.
 *
 * Reads the OAuth client_id + scopes from the manifest's `oauth2` block
 * (see manifest.config.ts). The Photos Picker scope is
 * `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`.
 *
 * Token lifecycle:
 *   - `getToken({ interactive: true })` launches the consent UI on first call,
 *     returns cached token on subsequent calls.
 *   - `getToken({ interactive: false })` is for "am I still connected?" checks
 *     — resolves to `null` (rather than throwing) if no cached token exists.
 *   - `clearToken(token)` removes a specific token from Chrome's identity
 *     cache. Call this after a 401 so the next `getToken` re-fetches.
 *   - `revoke(token)` POSTs to Google's revocation endpoint, severing the
 *     user→extension grant entirely (used by Settings "Disconnect").
 */

import { getLogger } from "@/observability/logger";
import { clearGoogleToken, getGoogleToken } from "@/lib/googleAuth";

const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
export const GOOGLE_PHOTOS_SCOPE =
  "https://www.googleapis.com/auth/photospicker.mediaitems.readonly";
const log = getLogger("photos:auth");

/**
 * Snapshot of the runtime state relevant to diagnosing a failed sign-in.
 * Captured at the moment of failure (or on demand) so users can copy/paste
 * the blob into a bug report or a chat.
 *
 * All fields are intentionally non-secret: the only string that even
 * resembles a credential is `oauth2ClientIdPrefix`, which is just the
 * first 12 chars of the public OAuth client_id (visible in the manifest
 * regardless).
 */
export interface PhotosDiagnostics {
  timestamp: string;
  /** "extension" when chrome.runtime.id is set, "web" otherwise. */
  context: "extension" | "web";
  chrome: {
    hasChromeGlobal: boolean;
    hasRuntime: boolean;
    runtimeId: string | null;
    hasIdentity: boolean;
    hasGetAuthToken: boolean;
    hasRemoveCachedAuthToken: boolean;
    lastRuntimeError: string | null;
  };
  manifest: {
    available: boolean;
    permissions: string[];
    hostPermissions: string[];
    /** True iff manifest.oauth2 is defined. */
    hasOauth2: boolean;
    /** First 12 chars of oauth2.client_id, or null if unset. */
    oauth2ClientIdPrefix: string | null;
    /** Whether the placeholder client_id is still in place. */
    oauth2ClientIdIsPlaceholder: boolean;
    oauth2Scopes: string[];
  };
  location: {
    protocol: string;
    origin: string;
    href: string;
  };
  userAgent: string;
}

const PLACEHOLDER_PREFIX = "REPLACE_WITH_YOUR_";

export function collectDiagnostics(): PhotosDiagnostics {
  const hasChromeGlobal = typeof chrome !== "undefined";
  const hasRuntime = hasChromeGlobal && !!chrome.runtime;
  const runtimeId =
    hasRuntime && typeof chrome.runtime?.id === "string"
      ? chrome.runtime.id
      : null;
  const hasIdentity = hasChromeGlobal && !!chrome.identity;
  const hasGetAuthToken = hasIdentity && typeof chrome.identity?.getAuthToken === "function";
  const hasRemoveCachedAuthToken =
    hasIdentity && typeof chrome.identity?.removeCachedAuthToken === "function";
  const lastRuntimeError =
    hasRuntime && chrome.runtime.lastError ? chrome.runtime.lastError.message ?? null : null;

  let manifestAvailable = false;
  let permissions: string[] = [];
  let hostPermissions: string[] = [];
  let oauth2: { client_id?: string; scopes?: string[] } | undefined;
  if (hasRuntime && typeof chrome.runtime?.getManifest === "function") {
    try {
      const m = chrome.runtime.getManifest() as chrome.runtime.Manifest & {
        oauth2?: { client_id?: string; scopes?: string[] };
        host_permissions?: string[];
      };
      manifestAvailable = true;
      permissions = Array.isArray(m.permissions) ? [...m.permissions] : [];
      hostPermissions = Array.isArray(m.host_permissions) ? [...m.host_permissions] : [];
      oauth2 = m.oauth2;
    } catch {
      manifestAvailable = false;
    }
  }
  const clientId = oauth2?.client_id ?? null;
  const clientIdPrefix = clientId ? clientId.slice(0, 12) : null;
  const clientIdIsPlaceholder =
    typeof clientId === "string" && clientId.startsWith(PLACEHOLDER_PREFIX);

  const safe = (fn: () => string) => {
    try {
      return fn();
    } catch {
      return "";
    }
  };

  return {
    timestamp: new Date().toISOString(),
    context: runtimeId ? "extension" : "web",
    chrome: {
      hasChromeGlobal,
      hasRuntime,
      runtimeId,
      hasIdentity,
      hasGetAuthToken,
      hasRemoveCachedAuthToken,
      lastRuntimeError,
    },
    manifest: {
      available: manifestAvailable,
      permissions,
      hostPermissions,
      hasOauth2: !!oauth2,
      oauth2ClientIdPrefix: clientIdPrefix,
      oauth2ClientIdIsPlaceholder: clientIdIsPlaceholder,
      oauth2Scopes: Array.isArray(oauth2?.scopes) ? [...(oauth2?.scopes ?? [])] : [],
    },
    location: {
      protocol: safe(() => window.location.protocol),
      origin: safe(() => window.location.origin),
      href: safe(() => window.location.href),
    },
    userAgent: safe(() => navigator.userAgent),
  };
}

/**
 * Human-readable, copy-pasteable diagnostic dump. The settings pane's
 * "Copy diagnostics" button writes this string to the clipboard.
 */
export function formatDiagnostics(d: PhotosDiagnostics): string {
  return JSON.stringify(d, null, 2);
}

/**
 * Best-effort one-line explanation of *why* sign-in is failing, based on the
 * diagnostic snapshot. Used to drive the headline error message in the UI
 * so the user sees the most likely cause without expanding the full JSON.
 */
export function explainFailure(d: PhotosDiagnostics): string {
  if (!d.chrome.hasChromeGlobal) {
    return "No `chrome` global — this page is not running inside a Chrome extension. Load the extension via chrome://extensions → Load unpacked and open the extension's New Tab.";
  }
  if (d.context === "web") {
    return "Running in a regular web page (chrome.runtime.id is unset). The Photos feature only works when the extension is loaded into Chrome — open a New Tab inside the loaded extension, not the Vite dev server.";
  }
  if (!d.chrome.hasIdentity) {
    return "`chrome.identity` is missing even though we're in extension context. Verify the manifest declares the `identity` permission and reload the extension at chrome://extensions.";
  }
  if (!d.manifest.hasOauth2) {
    return "Manifest is missing the `oauth2` block. Rebuild after editing manifest.config.ts and reload the extension.";
  }
  if (d.manifest.oauth2ClientIdIsPlaceholder) {
    return "OAuth client_id is still the placeholder from manifest.config.ts. Replace it with the real client_id from Google Cloud Console and reload the extension.";
  }
  if (!d.manifest.oauth2Scopes.some((s) => s.includes("photospicker"))) {
    return "Manifest oauth2.scopes does not include the Photos Picker scope. Confirm `photospicker.mediaitems.readonly` is listed in manifest.config.ts.";
  }
  if (d.chrome.lastRuntimeError) {
    return `Chrome reported: ${d.chrome.lastRuntimeError}`;
  }
  return "Unknown failure — see the diagnostic JSON below for full state.";
}

export class GoogleAuthError extends Error {
  readonly diagnostics: PhotosDiagnostics;
  constructor(
    message: string,
    diagnostics?: PhotosDiagnostics,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GoogleAuthError";
    this.diagnostics = diagnostics ?? collectDiagnostics();
  }
}

interface GetTokenOptions {
  interactive: boolean;
}

/**
 * Returns an OAuth access token, or `null` when `interactive: false` and no
 * cached token exists. Interactive mode throws `GoogleAuthError` (with a
 * captured `diagnostics` blob) on any failure, including user cancellation.
 */
export async function getToken(opts: GetTokenOptions): Promise<string | null> {
  log.debug("getToken.invoking", { interactive: opts.interactive });
  try {
    // Passing the scope explicitly is load-bearing now that Calendar shares
    // the OAuth client: connecting Photos must never request Calendar access.
    const token = await getGoogleToken({
      interactive: opts.interactive,
      scopes: [GOOGLE_PHOTOS_SCOPE],
    });
    if (token) log.debug("getToken.success", { tokenLength: token.length });
    else log.debug("getToken.silent.miss");
    return token;
  } catch (cause) {
    const diagnostics = collectDiagnostics();
    const diagnosticExplanation = explainFailure(diagnostics);
    const diagnosticIsSpecific =
      !diagnosticExplanation.startsWith("Unknown failure") &&
      !diagnosticExplanation.startsWith("Chrome reported:");
    const message = diagnosticIsSpecific
      ? diagnosticExplanation
      : cause instanceof Error
        ? cause.message
        : String(cause);
    log.error("getToken.failed", { message, diagnostics });
    // eslint-disable-next-line no-console
    console.error("[photos:auth] Google sign-in failed", {
      message,
      diagnostics,
    });
    throw new GoogleAuthError(message, diagnostics, cause);
  }
}

/**
 * Remove a specific token from Chrome's identity cache. The token itself
 * remains valid at Google's end (use `revoke` for that); this just forces
 * the next `getToken` call to round-trip Google's auth servers.
 *
 * Call after a 401 from the Photos API.
 */
export async function clearToken(token: string): Promise<void> {
  await clearGoogleToken(token);
}

/**
 * Revoke the OAuth grant at Google's side. After this the user's Google
 * Account no longer lists Proclivity under "Apps with access", and any
 * outstanding cached token returns 401.
 *
 * Throws unless Google returns success. Chrome's token cache is cleared in
 * either case, but callers must not claim remote revocation succeeded on a
 * network error or non-2xx response.
 */
export async function revoke(token: string): Promise<void> {
  try {
    const response = await fetch(REVOKE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
    });
    if (!response.ok) {
      throw new Error(
        `Google rejected the access-revocation request (${response.status}).`,
      );
    }
  } finally {
    // Revocation is account-wide for this Google Cloud project, so remove
    // every Chrome-cached Google token (Photos and Calendar), not only this
    // token. Do this even on failure so a rejected token is never reused.
    if (
      typeof chrome !== "undefined" &&
      chrome.identity?.clearAllCachedAuthTokens
    ) {
      await new Promise<void>((resolve) => {
        chrome.identity.clearAllCachedAuthTokens(() => resolve());
      });
    } else {
      await clearToken(token);
    }
  }
}
