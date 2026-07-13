import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import "./EmbedFrame.css";

/**
 * A full-bleed embedded website rendered inside a tab.
 *
 * Used by the OSINT and Finances (Monarch) tabs. The heavy lifting that makes
 * embedding *possible* lives outside this component:
 *
 *  - OSINT (osint-6g5.pages.dev) ships no anti-framing headers, so it frames
 *    with no special handling.
 *  - Monarch (app.monarch.com) sends `X-Frame-Options: SAMEORIGIN` and a CSP
 *    `frame-ancestors` directive that excludes chrome-extension:// origins. The
 *    static declarativeNetRequest ruleset in public/dnr/monarch-embed-rules.json
 *    strips those two headers from Monarch's sub-frame responses so the browser
 *    stops refusing the frame. See manifest.config.ts.
 *
 * This component just renders the frame, a slim toolbar with an always-present
 * "Open externally" escape hatch (important because header-stripping can't fix
 * third-party-cookie or frame-busting-JS breakage), and a loading state.
 */
export interface EmbedFrameProps {
  /** URL to embed. */
  src: string;
  /** Human title — labels the toolbar and the iframe for a11y. */
  title: string;
  /**
   * Optional `sandbox` token string. Omit for a fully-trusted embed (e.g. the
   * user's own OSINT tool). Monarch passes a set that deliberately excludes
   * `allow-top-navigation` so frame-busting scripts can't hijack the new-tab
   * page, while still allowing scripts, its own-origin storage, forms and
   * OAuth popups.
   */
  sandbox?: string;
  /** Extra note shown in the toolbar when the frame may be blocked. */
  note?: string;
}

export function EmbedFrame({ src, title, sandbox, note }: EmbedFrameProps) {
  const [loaded, setLoaded] = useState(false);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  // Reset the loading state if the src changes (defensive — src is static per
  // tab today, but this keeps the spinner honest if a URL ever becomes dynamic).
  useEffect(() => {
    setLoaded(false);
  }, [src]);

  return (
    <div className="embed-frame">
      <div className="embed-frame__bar">
        <span className="embed-frame__title">{title}</span>
        {note ? <span className="embed-frame__note">{note}</span> : null}
        <a
          className="embed-frame__external"
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open ${title} in a new tab`}
        >
          <ExternalLink size={14} aria-hidden="true" />
          <span>Open externally</span>
        </a>
      </div>
      <div className="embed-frame__viewport">
        {!loaded && (
          <div className="embed-frame__loading" aria-hidden="true">
            <span className="embed-frame__spinner" />
            <span>Loading {title}…</span>
          </div>
        )}
        <iframe
          ref={frameRef}
          className="embed-frame__iframe"
          src={src}
          title={title}
          onLoad={() => setLoaded(true)}
          data-loaded={loaded ? "true" : undefined}
          allow="clipboard-read; clipboard-write; fullscreen"
          {...(sandbox !== undefined ? { sandbox } : {})}
        />
      </div>
    </div>
  );
}

export default EmbedFrame;
