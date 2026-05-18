#!/usr/bin/env bash
# Verify the Proclivity Vite dev server is reachable before dispatching the
# visual scout.  Exits 0 on green, 1 on red — the slash command body invokes
# this BEFORE Phase 1 dispatch as a hook-like preflight check.
#
# Usage: ensure-preview-up.sh [host] [port]
# Defaults: host=localhost, port=5173
#
# Proclivity is an MV3 Chrome extension; the dev server serves the newtab
# entry at http://localhost:5173/src/newtab/index.html.  We probe that URL
# specifically (not just the root) because Vite's root route returns a
# different shape than the entry point and we want a meaningful health
# signal.

set -euo pipefail

HOST="${1:-localhost}"
PORT="${2:-5173}"
URL="http://${HOST}:${PORT}/src/newtab/index.html"

# 3-second timeout, follow redirects, fail on HTTP >= 400.  We only care about
# whether the server responds with something HTML-ish; the visual scout will
# do the deep DOM-level inspection.
if curl --silent --fail --max-time 3 --location --output /dev/null --write-out "%{http_code}" "$URL" 2>/dev/null | grep -qE '^(200|301|302|307|308)$'; then
  echo "[ok] newtab reachable at $URL"
  exit 0
fi

# Red path — emit a copy-paste recovery hint and exit non-zero.
cat <<EOF >&2
[fail] newtab NOT reachable at $URL

Before /frontend-uplift can run its visual scout, the Vite dev server must
be up.  Start it in another terminal:

    npm run dev

Vite is configured with strictPort: true on 5173, so this preflight will
re-test that exact port.  Then re-invoke the slash command.  This check
runs ONLY before Phase 1; once discover is past, you may stop the server.
EOF
exit 1
