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

const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
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
  if (typeof chrome === "undefined" || !chrome.identity?.getAuthToken) {
    const diag = collectDiagnostics();
    const explanation = explainFailure(diag);
    log.error("getToken.unavailable", {
      explanation,
      diagnostics: diag,
    });
    // Also write a console.error so the user can copy it from DevTools even
    // if observability persistence is off.
    // eslint-disable-next-line no-console
    console.error("[photos:auth] chrome.identity unavailable", {
      explanation,
      diagnostics: diag,
    });
    throw new GoogleAuthError(explanation, diag);
  }
  return new Promise<string | null>((resolve, reject) => {
    log.debug("getToken.invoking", { interactive: opts.interactive });
    chrome.identity.getAuthToken({ interactive: opts.interactive }, (result) => {
      const lastError = chrome.runtime.lastError?.message;
      if (lastError) {
        // Non-interactive "not signed in" comes back as an error string —
        // treat it as a soft `null` so callers can render a Connect button
        // without try/catch noise.
        if (!opts.interactive) {
          log.debug("getToken.silent.miss", { lastError });
          resolve(null);
          return;
        }
        const diag = collectDiagnostics();
        log.error("getToken.runtimeError", {
          lastError,
          diagnostics: diag,
        });
        // eslint-disable-next-line no-console
        console.error("[photos:auth] chrome.identity returned an error", {
          lastError,
          diagnostics: diag,
        });
        // Prefer a diagnostic-derived explanation (e.g. "placeholder client_id")
        // over Chrome's verbatim message ("bad client id: {0}") when one fits.
        // The raw lastError is still in diag.chrome.lastRuntimeError if anyone
        // wants to read it. We fall back to lastError when no specific
        // explanation applies.
        const explanation = explainFailure(diag);
        const isGeneric =
          explanation.startsWith("Unknown failure") ||
          explanation.startsWith("Chrome reported:");
        reject(new GoogleAuthError(isGeneric ? lastError : explanation, diag));
        return;
      }
      // MV3 returns `{ token, grantedScopes }`; MV2 returned a bare string.
      // Handle both shapes for safety.
      const token =
        typeof result === "string"
          ? result
          : (result as { token?: string } | undefined)?.token;
      if (!token) {
        if (!opts.interactive) {
          resolve(null);
          return;
        }
        const diag = collectDiagnostics();
        log.error("getToken.noToken", { diagnostics: diag });
        // eslint-disable-next-line no-console
        console.error("[photos:auth] chrome.identity returned no token", {
          diagnostics: diag,
        });
        reject(
          new GoogleAuthError("No token returned from chrome.identity", diag),
        );
        return;
      }
      log.debug("getToken.success", { tokenLength: token.length });
      resolve(token);
    });
  });
}

/**
 * Remove a specific token from Chrome's identity cache. The token itself
 * remains valid at Google's end (use `revoke` for that); this just forces
 * the next `getToken` call to round-trip Google's auth servers.
 *
 * Call after a 401 from the Photos API.
 */
export async function clearToken(token: string): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.identity?.removeCachedAuthToken)
    return;
  await new Promise<void>((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}

/**
 * Revoke the OAuth grant at Google's side. After this the user's Google
 * Account no longer lists Proclivity under "Apps with access", and any
 * outstanding cached token returns 401.
 *
 * Failure is non-fatal — we still clear the local cache so the UI flips back
 * to disconnected.
 */
export async function revoke(token: string): Promise<void> {
  try {
    await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  } catch {
    // Network failure during revoke is non-fatal — clearToken below still
    // makes the extension forget the token locally.
  }
  await clearToken(token);
}
