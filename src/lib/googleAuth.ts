/** Shared, scope-explicit OAuth helpers for Proclivity's Google integrations. */

export type GoogleIdentityErrorCode =
  | "unavailable"
  | "oauth-failed"
  | "scope-denied";

export class GoogleIdentityError extends Error {
  constructor(
    message: string,
    readonly code: GoogleIdentityErrorCode,
  ) {
    super(message);
    this.name = "GoogleIdentityError";
  }
}

export interface GoogleTokenOptions {
  interactive: boolean;
  /** Required: every integration must declare exactly the scopes it needs. */
  scopes: readonly string[];
}

/**
 * Return a Chrome-managed OAuth token for exactly `scopes`.
 *
 * Tokens are never persisted by Proclivity. Chrome owns caching and expiry.
 * Silent misses return null so page-load checks never trigger consent UI.
 */
export async function getGoogleToken(
  options: GoogleTokenOptions,
): Promise<string | null> {
  if (options.scopes.length === 0) {
    throw new GoogleIdentityError(
      "At least one Google OAuth scope is required.",
      "oauth-failed",
    );
  }

  if (typeof chrome === "undefined" || !chrome.identity?.getAuthToken) {
    if (!options.interactive) return null;
    throw new GoogleIdentityError(
      "Google sign-in is only available in the loaded Chrome extension. Rebuild Proclivity, reload it at chrome://extensions, and open a new tab.",
      "unavailable",
    );
  }

  const details = {
    interactive: options.interactive,
    scopes: [...options.scopes],
    // Supported by current Chrome; the pinned @types/chrome release has not
    // yet added this optional Identity API field.
    enableGranularPermissions: true,
  } as chrome.identity.TokenDetails & { enableGranularPermissions: boolean };

  try {
    // The Promise form returns { token, grantedScopes }. Chrome's callback form
    // uses two positional arguments, so mixing the shapes would silently skip
    // granular-consent validation.
    const result = await chrome.identity.getAuthToken(details);
    const token = result.token;
    if (!token) {
      if (!options.interactive) return null;
      throw new GoogleIdentityError(
        "Chrome did not return a Google access token.",
        "oauth-failed",
      );
    }
    const missing = result.grantedScopes
      ? options.scopes.filter(
          (scope) => !result.grantedScopes!.includes(scope),
        )
      : [];
    if (missing.length > 0) {
      if (!options.interactive) return null;
      throw new GoogleIdentityError(
        "The requested Google permission was not granted.",
        "scope-denied",
      );
    }
    return token;
  } catch (cause) {
    if (!options.interactive) return null;
    if (cause instanceof GoogleIdentityError) throw cause;
    throw new GoogleIdentityError(
      cause instanceof Error ? cause.message : String(cause),
      "oauth-failed",
    );
  }
}

/** Forget one access token locally without revoking the account-wide grant. */
export async function clearGoogleToken(token: string): Promise<void> {
  if (
    typeof chrome === "undefined" ||
    !chrome.identity?.removeCachedAuthToken
  ) {
    return;
  }
  await new Promise<void>((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}
