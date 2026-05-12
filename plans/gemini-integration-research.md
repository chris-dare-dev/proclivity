# Gemini Integration Research: OAuth + Structured Output for Proclivity

**Purpose:** Implementation-ready research for wiring a Google account OAuth flow into the Proclivity Chrome extension so Gemini can generate `Todo` and `GanttTask` arrays. No marketing copy. Decisions are grounded in fetched 2026 docs.

---

## Table of Contents

1. [OAuth Client ID Setup for Chrome Extensions](#1-oauth-client-id-setup-for-chrome-extensions)
2. [chrome.identity.getAuthToken vs launchWebAuthFlow](#2-chromeidentitygetauthtoken-vs-launchwebauthflow)
3. [Gemini API: Endpoints, Scopes, Quotas](#3-gemini-api-endpoints-scopes-quotas)
4. [Structured Output for Todos and Gantt Tasks](#4-structured-output-for-todos-and-gantt-tasks)
5. [Gemini Nano / On-Device Option](#5-gemini-nano--on-device-option)
6. [Concrete Implementation Plan](#6-concrete-implementation-plan)
7. [Sharp Edges / Things to Watch](#7-sharp-edges--things-to-watch)
8. [Verified Against](#8-verified-against)

---

## 1. OAuth Client ID Setup for Chrome Extensions

### 1.1 Creating the Client ID in Google Cloud Console

**Flow (verified May 2026):**

1. Open [Google Cloud Console](https://console.cloud.google.com) and select or create a project.
2. Enable the **Generative Language API**: APIs & Services → Library → search "Generative Language API" → Enable.
3. Configure the OAuth Consent Screen: APIs & Services → OAuth consent screen.
   - User type: **External** (required for a personal Google account; "Internal" requires Google Workspace).
   - Fill in App name, support email, developer email.
   - Add scopes: `https://www.googleapis.com/auth/cloud-platform` and/or `https://www.googleapis.com/auth/generative-language.retriever` (see §3.2 for which is actually needed).
   - Add yourself as a **Test user** — mandatory until the app is published. In "Testing" status you can consent, but the token carries a 7-day expiry that Chrome auto-refreshes, so this is fine for personal use.
4. Create credentials: APIs & Services → Credentials → Create Credentials → OAuth client ID.
   - **Application type: Chrome Extension**
   - In the **"Item ID"** field: paste your stable 32-character extension ID (see §1.3).
   - Click Create. Copy the client ID — it looks like `123456789012-abcdefgh...apps.googleusercontent.com`.
   - Note: Chrome Extension OAuth clients have **no client secret**. Google treats them as public clients. There is nothing to keep private about the client ID itself.

**Billing note:** A billing account is NOT required for the free tier. You can stay entirely on the free tier for personal use without entering a credit card. The cost implication is that free-tier data *may be used to improve Google models* (see §7.6). If that matters, adding billing and staying under pay-as-you-go still keeps cost near zero at personal-extension usage levels.

---

### 1.2 Extension ID Stability

**Problem:** Chrome assigns extension IDs dynamically based on the directory the extension is loaded from. An unpacked dev build on machine A gets a different ID than on machine B. The OAuth client ID is bound to a single extension ID, so this must be stabilized.

**Solution: the `key` field in `manifest.json`.**

The extension ID is deterministically derived from the public key stored in the manifest `key` field:

```
extension_id = first32chars(sha256(DER-encoded-public-key)), with 0-9a-f → a-p substitution
```

Adding the same `key` to the manifest on every machine guarantees the same ID everywhere.

---

### 1.3 Generating a Stable Key Without Uploading to the Chrome Web Store

The recommended offline approach (no dashboard upload required):

```bash
# 1. Generate a 2048-bit RSA private key in PKCS8 format
openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out proclivity-ext.pem

# 2. Derive the Base64 public key (paste this into manifest "key" field)
openssl rsa -in proclivity-ext.pem -pubout -outform DER | openssl base64 -A

# 3. Derive the stable extension ID (for verifying it matches Cloud Console)
openssl rsa -in proclivity-ext.pem -pubout -outform DER | sha256sum | head -c32 | tr 0-9a-f a-p
```

**Private key hygiene:**
- Store `proclivity-ext.pem` outside the repo: e.g., `~/.config/proclivity/proclivity-ext.pem` or a password manager vault.
- Add `*.pem` to `.gitignore` in the project root if the file ever lands nearby.
- The *public key* that goes into `manifest.json` (the long Base64 string) is fine to commit — it is not a secret.

**Manifest delta (add to `manifest.config.ts`):**

```typescript
// manifest.config.ts — the key field is safe to commit (public key only)
export default defineManifest((config, env) => ({
  manifest_version: 3,
  name: "Proclivity",
  // ... existing fields ...
  key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...", // your generated Base64 public key
  oauth2: {
    client_id: "YOUR_CLIENT_ID.apps.googleusercontent.com",
    scopes: [
      "https://www.googleapis.com/auth/generative-language.retriever",
    ],
  },
  permissions: ["storage", "alarms", "notifications", "identity"],
  // host_permissions for the Gemini API endpoint (required for fetch in MV3)
  host_permissions: [
    "https://generativelanguage.googleapis.com/*",
  ],
}));
```

**Note on `defineManifest` callback form:** The `key` field can also be injected from an environment variable by converting `defineManifest` to its callback form:

```typescript
export default defineManifest((config, env) => ({
  // ...
  key: process.env.CRX_PUBLIC_KEY ?? "",
}));
```

Then add `CRX_PUBLIC_KEY=<base64>` to `.env.local` (which should be in `.gitignore`). Either approach is fine; committing the public key is also acceptable since it reveals nothing sensitive.

---

## 2. chrome.identity.getAuthToken vs launchWebAuthFlow

### 2.1 Decision for This Extension

**Use `chrome.identity.getAuthToken`.** Reasons:

- Proclivity is Chrome-only (MV3, `chrome_url_overrides`, service worker). Portability is not a concern.
- `getAuthToken` delegates the entire OAuth flow to Chrome's built-in system — no redirect URI handling, no PKCE, no token storage, no refresh logic.
- The token cache is managed by Chrome and handles expiry automatically.
- `launchWebAuthFlow` requires you to implement PKCE, receive the auth code via redirect, exchange it for tokens, store the refresh token, and refresh it yourself. That is substantial extra code with no benefit for a Google-only flow.

### 2.2 Manifest Requirements

```json
{
  "permissions": ["identity"],
  "oauth2": {
    "client_id": "...",
    "scopes": ["https://www.googleapis.com/auth/generative-language.retriever"]
  }
}
```

No `host_permissions` entry is required for `getAuthToken` itself. However, the fetch call to `generativelanguage.googleapis.com` does require a `host_permissions` entry in MV3 (see §1.3 above).

### 2.3 Consent UX

- First call with `{ interactive: true }`: Chrome shows its **native account picker** (not a web page) — the user selects their Google account and approves the scopes. This is a Chrome-native dialog, not a browser tab.
- Subsequent calls with `{ interactive: false }`: Chrome returns the cached token silently with no UI.
- If the OAuth consent screen is in **Testing** status, only test users (added in Cloud Console) can consent. This is the expected state for a personal extension that is never published.

### 2.4 Token Refresh Behavior

- Chrome caches access tokens in memory.
- When a cached token nears expiry, Chrome refreshes it transparently on the next `getAuthToken` call. The caller sees no difference.
- If a token becomes invalid mid-session (revoked, network failure, session invalidated), `getAuthToken` will still return the stale cached token. The API call will return HTTP 401.

**Pattern for handling 401 mid-session:**

```typescript
async function fetchGemini(url: string, body: object): Promise<Response> {
  const { token } = await chrome.identity.getAuthToken({ interactive: false });
  let res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    // Token was stale — evict from cache and get a fresh one
    await chrome.identity.removeCachedAuthToken({ token: token! });
    const { token: freshToken } = await chrome.identity.getAuthToken({ interactive: false });
    res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${freshToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  return res;
}
```

### 2.5 Sign-Out / Revoke Flow

`chrome.identity` does not have a single `signOut()`. Use this sequence:

```typescript
async function disconnectGoogleAccount(): Promise<void> {
  // 1. Removes all cached tokens AND clears account preferences
  await chrome.identity.clearAllCachedAuthTokens();
  // 2. Optionally revoke at Google's server so the app loses access entirely
  //    (chrome.identity doesn't do this automatically)
  // The revoke endpoint is https://oauth2.googleapis.com/revoke?token=<access_token>
  // but you need a valid token to revoke, which clearAllCachedAuthTokens just wiped.
  // Practical approach for a personal extension: clearAllCachedAuthTokens is sufficient.
  // The user can revoke from https://myaccount.google.com/permissions if needed.
}
```

### 2.6 Deprecation Status (May 2026)

No deprecation notices on `getAuthToken` or `launchWebAuthFlow` as of the January 2026 docs update. Both remain stable in MV3. The only API-level change recently was `enableGranularPermissions` (Chrome 87+) which is an additive opt-in for more granular consent UI.

---

## 3. Gemini API: Endpoints, Scopes, Quotas

### 3.1 Base URL and Model Selector

```
POST https://generativelanguage.googleapis.com/v1beta/models/{MODEL_ID}:generateContent
Authorization: Bearer {oauth_access_token}
Content-Type: application/json
```

**Stable model IDs (May 2026):**

| Model | API ID | Status | Context Window | Max Output |
|---|---|---|---|---|
| Gemini 2.5 Flash | `gemini-2.5-flash` | Stable | 1M tokens | 65,536 tokens |
| Gemini 2.5 Flash-Lite | `gemini-2.5-flash-lite` | Stable | 1M tokens | ~32K tokens |
| Gemini 2.5 Pro | `gemini-2.5-pro` | Available | 1M tokens | 65,536 tokens |

Use `gemini-2.5-flash` as the primary model. It is the best cost/quality tradeoff for short structured-output tasks in a personal extension. Do not use `-latest` aliases in production code — they can receive updates with only 2-week notice.

**Note on v1 vs v1beta:** All current Gemini API features, including structured output, are on `v1beta`. The `v1` path exists but has fewer models and features. Use `v1beta`.

### 3.2 Required OAuth Scopes

Two scopes appear in Google's documentation:

- `https://www.googleapis.com/auth/generative-language.retriever` — specifically named in the Gemini API OAuth quickstart
- `https://www.googleapis.com/auth/cloud-platform` — a broader scope that includes Gemini

**Recommendation:** Request only `generative-language.retriever` initially. If you hit authorization errors, add `cloud-platform`. Requesting fewer scopes is better UX (narrower consent dialog) and better security posture.

**What the user needs to do on the Google Cloud side:**

1. Create a Google Cloud project (free, no billing needed).
2. Enable the **Generative Language API** in that project.
3. Configure an OAuth Consent Screen (External, Testing status is fine).
4. Create an OAuth 2.0 Client ID of type **Chrome Extension** with the stable extension ID.

That is the complete list. No service account, no Vertex AI, no Cloud Storage bucket.

### 3.3 Free Tier Rate Limits (March 2026 data — subject to change)

| Model | RPM | RPD | TPM |
|---|---|---|---|
| Gemini 2.5 Flash | 10 | 250 | 250,000 |
| Gemini 2.5 Flash-Lite | 15 | 1,000 | 250,000 |
| Gemini 2.5 Pro | 5 | 100 | 250,000 |

**Context:** Google quietly cut free-tier limits by 50–80% in December 2025. The 250 RPD for Flash is current as of March 2026. For a personal extension, 250 requests/day is ample — a user is unlikely to generate more than 5–10 LLM-assisted task lists or Gantt breakdowns per day.

**The limits are per project, not per API key.** Chrome extension OAuth calls against your Cloud project count against your project's quota.

### 3.4 Pricing (Pay-as-you-go, if billing is enabled)

| Model | Input ($/M tokens) | Output ($/M tokens) |
|---|---|---|
| Gemini 2.5 Flash | $0.30 (text) | $2.50 (incl. thinking) |
| Gemini 2.5 Flash-Lite | $0.10 (text) | $0.40 |
| Gemini 2.5 Pro | $1.25 (<200k) / $2.50 (>200k) | $10.00 / $15.00 |

A typical structured-output call for generating 10 todos from a 100-word brief will be roughly 300 input tokens + 400 output tokens. At Flash pricing: ($0.30 × 0.0003) + ($2.50 × 0.0004) = $0.000090 + $0.001000 = **~$0.001 per call**. 250 calls/month = $0.25. Not a meaningful cost risk.

### 3.5 Data Privacy

- **Free tier:** Prompts and responses *may be used to improve Google products*. This is explicitly stated in the terms.
- **Paid tier (billing enabled):** Enterprise-grade data privacy — prompts are not used for training.

For a personal extension this probably doesn't matter. The guardrails in §6.6 (send only the user's typed brief, not the full state) limit exposure anyway.

---

## 4. Structured Output for Todos and Gantt Tasks

### 4.1 Recommended Pattern: `response_mime_type` + `response_schema`

This is the right choice for both use cases. It is:

- More reliable than plain JSON in system instruction (no guarantee of JSON output, model can deviate)
- Simpler than function calling (which is for agentic tool-use, not response formatting)
- Supported on Gemini 2.5 Flash and all currently active models

The API guarantees **syntactically valid JSON** conforming to the schema. It does NOT guarantee semantic correctness (e.g., plausible dates). Application-level validation is still required.

### 4.2 HTTP Request Body Format

The REST body uses `generationConfig` with `response_mime_type` and `response_schema` (snake_case for REST; camelCase works too — both are accepted):

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [{ "text": "..." }]
    }
  ],
  "systemInstruction": {
    "parts": [{ "text": "..." }]
  },
  "generationConfig": {
    "response_mime_type": "application/json",
    "response_schema": { ... }
  }
}
```

### 4.3 Use Case 1: Generate Todos

**Data shape from `src/types/index.ts`:**

```typescript
interface Todo {
  id: string;         // generated client-side — do NOT ask Gemini for IDs
  title: string;
  notes?: string | undefined;
  scope: "today" | "sprint" | "long";
  done: boolean;      // always false for new tasks
  createdAt: number;  // ms epoch — generated client-side
  dueAt?: number | undefined;   // ask Gemini for ISO date string, convert
  sprintId?: string | undefined; // supply the active sprint ID in the prompt
}
```

**Strategy:** Ask Gemini only for the fields it can meaningfully fill: `title`, `scope`, optionally `dueAt` as ISO string, optionally a boolean `includeInActiveSprint`. Generate `id`, `done`, `createdAt` client-side.

**Complete HTTP request body:**

```json
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent

{
  "contents": [
    {
      "role": "user",
      "parts": [{
        "text": "Plan out the tasks for: Launch a landing page for my side project by end of month."
      }]
    }
  ],
  "systemInstruction": {
    "parts": [{
      "text": "You are a personal productivity assistant. The user will give you a brief description of a goal or project. Return a JSON array of tasks to accomplish it.\n\nRules:\n- scope must be one of: today, sprint, long\n  - 'today': task should be done today or is a quick action under 30 min\n  - 'sprint': task fits a 1-2 week sprint; used only if sprintActive=true\n  - 'long': task is a multi-day or open-ended goal\n- dueAt: optional ISO 8601 date (YYYY-MM-DD) if a deadline is obvious; omit otherwise\n- notes: optional one-sentence detail or context; omit if not needed\n- title: concise action phrase, max 80 characters\n- Return 3-10 tasks. Do not include numbering or bullet points in titles.\n- Today's date: {{TODAY_DATE}}\n- Active sprint: {{SPRINT_ACTIVE}} (true/false)"
    }]
  },
  "generationConfig": {
    "response_mime_type": "application/json",
    "response_schema": {
      "type": "ARRAY",
      "items": {
        "type": "OBJECT",
        "properties": {
          "title":  { "type": "STRING", "description": "Concise action phrase" },
          "scope":  { "type": "STRING", "enum": ["today", "sprint", "long"] },
          "notes":  { "type": "STRING", "description": "Optional context or detail" },
          "dueAt":  { "type": "STRING", "description": "ISO 8601 date YYYY-MM-DD or empty string" }
        },
        "required": ["title", "scope"],
        "propertyOrdering": ["title", "scope", "notes", "dueAt"]
      }
    }
  }
}
```

**Client-side post-processing (TypeScript sketch):**

```typescript
interface GeminiTodoItem {
  title: string;
  scope: "today" | "sprint" | "long";
  notes?: string;
  dueAt?: string; // ISO date string or empty
}

function hydrateTodos(
  items: GeminiTodoItem[],
  activeSprintId: string | undefined,
): Todo[] {
  return items.map((item) => ({
    id: uid(),
    title: item.title,
    scope: item.scope,
    notes: item.notes || undefined,
    done: false,
    createdAt: Date.now(),
    dueAt: item.dueAt ? new Date(item.dueAt).getTime() || undefined : undefined,
    sprintId: item.scope === "sprint" ? activeSprintId : undefined,
  }));
}
```

---

### 4.4 Use Case 2: Generate Gantt Tasks

**Data shape from `src/types/index.ts`:**

```typescript
interface GanttTask {
  id: string;         // client-side
  chartId: string;    // supplied by caller — Gemini doesn't know this
  parentId?: string | undefined;  // tree structure — tricky (see below)
  title: string;
  startsAt: number;   // ms epoch
  endsAt: number;     // ms epoch
  progress: number;   // always 0 for new tasks
  done: boolean;      // always false for new tasks
}
```

**Nesting challenge:** Gemini cannot generate stable `parentId` references that match client-generated IDs. Workaround: ask Gemini for a flat list with a `parentTitle` field for nesting hints, then resolve IDs client-side after generating all tasks. Alternatively, ask for only a two-level flat list (phases + tasks) and do the parenting client-side.

**Complete HTTP request body:**

```json
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent

{
  "contents": [
    {
      "role": "user",
      "parts": [{
        "text": "Break down into a Gantt chart: Build and ship a personal portfolio website in 6 weeks, starting next Monday."
      }]
    }
  ],
  "systemInstruction": {
    "parts": [{
      "text": "You are a project planning assistant. The user will describe a project goal and timeline. Return a flat JSON array of Gantt chart tasks.\n\nRules:\n- Each task has: title, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), parentTitle (string or null for top-level)\n- Top-level tasks are phases or major milestones. Child tasks are subtasks within a phase.\n- parentTitle must exactly match a title of another task in the array (or be null).\n- Dates must be realistic given the user's stated timeline.\n- Do not generate IDs. Do not generate progress or done fields.\n- Return 6-20 tasks covering the full project.\n- Today's date: {{TODAY_DATE}}\n- Project start date (if not stated by user): {{DEFAULT_START_DATE}}"
    }]
  },
  "generationConfig": {
    "response_mime_type": "application/json",
    "response_schema": {
      "type": "ARRAY",
      "items": {
        "type": "OBJECT",
        "properties": {
          "title":       { "type": "STRING" },
          "startDate":   { "type": "STRING", "description": "YYYY-MM-DD" },
          "endDate":     { "type": "STRING", "description": "YYYY-MM-DD, must be >= startDate" },
          "parentTitle": { "type": "STRING", "description": "Title of parent task, or empty string for top-level" }
        },
        "required": ["title", "startDate", "endDate", "parentTitle"],
        "propertyOrdering": ["title", "startDate", "endDate", "parentTitle"]
      }
    }
  }
}
```

**Client-side post-processing:**

```typescript
interface GeminiGanttItem {
  title: string;
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  parentTitle: string; // empty = top-level
}

function hydrateGanttTasks(
  items: GeminiGanttItem[],
  chartId: string,
): GanttTask[] {
  // First pass: build title → id map
  const idByTitle = new Map<string, string>();
  for (const item of items) {
    idByTitle.set(item.title, uid());
  }
  // Second pass: resolve parentId
  return items.map((item) => {
    const id = idByTitle.get(item.title)!;
    const parentId = item.parentTitle
      ? idByTitle.get(item.parentTitle)
      : undefined;
    return {
      id,
      chartId,
      parentId: parentId ?? undefined,
      title: item.title,
      startsAt: new Date(item.startDate).getTime(),
      endsAt: new Date(item.endDate).getTime(),
      progress: 0,
      done: false,
    };
  });
}
```

**Warning:** The two-pass parentId resolution depends on Gemini using the exact same string in `parentTitle` as it used in a `title`. With structured output, title strings are constrained to STRING type but not constrained to match other titles. Validate post-processing: if a `parentTitle` is not found in `idByTitle`, treat the task as top-level (don't hard-fail).

### 4.5 Model Recommendation

**Gemini 2.5 Flash** is the right choice for both use cases:

- Better reasoning than Flash-Lite (important for date arithmetic in Gantt tasks)
- 10x cheaper than Pro ($0.30 vs $1.25 per million input tokens)
- 65,536 output tokens is more than sufficient for a 20-task structured array
- Structured output is fully supported and stable

Only escalate to Pro if Flash output quality is consistently poor for a specific prompt type — which is unlikely for 3-10 item task lists.

---

## 5. Gemini Nano / On-Device Option

### 5.1 Current Status (May 2026)

The Chrome Prompt API (built-in AI, Gemini Nano) is in **origin trial** as of Chrome 148. The base Prompt API functionality shipped in Chrome 138. Structured output via `responseConstraint` (JSON Schema) is available as of Chrome 137.

The API is **not yet on stable channel for all users** — it requires origin trial enrollment or users enabling `chrome://flags/#optimization-guide-on-device-model`. Chrome 148 is rolling out, but the Prompt API is not universally on by default.

### 5.2 Usage API

```javascript
// Check availability
const availability = await LanguageModel.availability();
// Returns: "readily" | "available" | "downloadable" | "unavailable"

if (availability !== "unavailable") {
  const session = await LanguageModel.create();
  const result = await session.prompt(
    "Generate tasks for: launch a landing page",
    {
      responseConstraint: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            scope: { type: "string", enum: ["today", "sprint", "long"] }
          },
          required: ["title", "scope"]
        }
      }
    }
  );
  const tasks = JSON.parse(result);
}
```

### 5.3 Hardware Requirements

| Requirement | Minimum |
|---|---|
| OS | Windows 10/11, macOS 13+, Linux, ChromeOS (Chromebook Plus only) |
| Storage | ≥ 22 GB free |
| GPU VRAM | > 4 GB, OR |
| CPU RAM | ≥ 16 GB with ≥ 4 cores |

The model download is ~4.27 GB (Gemini Nano v3).

### 5.4 Extension Service Worker Compatibility

The Prompt API docs do not explicitly confirm it works from an extension's service worker. The API is exposed on `window` (and likely `self`) in extension pages, but service workers may not have access. **This needs testing before relying on it.** The new-tab page (where Proclivity's React UI runs) is an extension page and should have access.

### 5.5 User Opt-In

Beyond Chrome version and hardware, users must:

1. Have a compatible device (memory, storage, OS).
2. Acknowledge Google's Generative AI Prohibited Uses Policy the first time they use any built-in AI feature.
3. On first use, the model downloads automatically (~4.27 GB) on an unmetered connection.

### 5.6 Pros/Cons vs Cloud Gemini

| Dimension | Gemini Nano (on-device) | Gemini 2.5 Flash (cloud) |
|---|---|---|
| **Privacy** | Better — data never leaves device. Free tier cloud may be used for training | Worse on free tier |
| **Quality** | Significantly weaker — Nano is a small model optimized for device footprint | Much stronger reasoning and instruction-following |
| **Cost** | Free, always | Free up to 250 RPD; ~$0.001/call after |
| **Latency** | No network round-trip — but model loading can be slow on first call | ~1-3s network call |
| **Availability** | Requires compatible hardware, Chrome 137+, origin trial or flag | Works for any signed-in user |
| **Structured output** | Supported via `responseConstraint` (Chrome 137+) | Fully supported |
| **Setup complexity** | No OAuth, no Cloud Console setup | Requires Cloud Console + OAuth |

### 5.7 Recommendation

Do NOT use Gemini Nano as the primary path. The hardware requirements (22 GB storage, ≥16 GB RAM or 4 GB VRAM) exclude a meaningful fraction of users, and the model quality for date-aware Gantt planning is likely inadequate.

It is worth implementing as a **fallback** behind `LanguageModel.availability()` — specifically for users who have not connected a Google account and happen to have compatible hardware. The fallback UI message: "Connect a Google account for higher quality AI suggestions, or use on-device AI if available."

---

## 6. Concrete Implementation Plan

### Step-by-step (≤20 steps)

**Phase A: Stable extension ID (one-time setup, done by developer)**

1. **Generate the RSA key pair** using the openssl commands in §1.3. Store `proclivity-ext.pem` in `~/.config/proclivity/` (outside repo). Add `*.pem` to `.gitignore`.

2. **Commit the public key** to `manifest.config.ts` in the `key` field. Use the Base64 string from `openssl rsa -in proclivity-ext.pem -pubout -outform DER | openssl base64 -A`. Verify the derived ID matches what `chrome://extensions` shows for the loaded extension.

3. **Register the OAuth client** in Google Cloud Console following §1.1. Paste the stable extension ID into the "Item ID" field. Save the client ID.

**Phase B: Manifest delta**

4. **Update `manifest.config.ts`** to add:
   - `key: "<base64 public key>"` (or load from `process.env.CRX_PUBLIC_KEY`)
   - `permissions: ["storage", "alarms", "notifications", "identity"]`
   - `oauth2: { client_id: "...", scopes: ["https://www.googleapis.com/auth/generative-language.retriever"] }`
   - `host_permissions: ["https://generativelanguage.googleapis.com/*"]`
   
   Do not add `host_permissions` for `accounts.google.com` — `getAuthToken` handles the Google sign-in flow internally without needing that permission declared.

**Phase C: LLM module**

5. **Create `src/llm/gemini.ts`** with the following public API:

```typescript
// src/llm/gemini.ts — function signatures (not full implementation)

/** Returns the OAuth token, prompting interactively if needed. */
export async function getToken(interactive: boolean): Promise<string>;

/** Clears all cached tokens and marks the account as disconnected. */
export async function disconnect(): Promise<void>;

/** Returns true if a token is available without user interaction. */
export async function isConnected(): Promise<boolean>;

/** 
 * Calls Gemini with a user brief and returns Todo-shaped objects
 * ready for hydration. Throws GeminiError on API failure.
 */
export async function generateTodos(
  brief: string,
  opts: { activeSprint: Sprint | undefined; scope?: TodoScope },
): Promise<GeminiTodoItem[]>;

/**
 * Calls Gemini with a project brief and returns Gantt-task-shaped
 * objects ready for hydration. Throws GeminiError on API failure.
 */
export async function generateGanttTasks(
  brief: string,
  opts: { projectStart: Date },
): Promise<GeminiGanttItem[]>;

/** Structured error class with HTTP status and quota-exceeded flag */
export class GeminiError extends Error {
  constructor(
    message: string,
    public status: number,
    public isRateLimited: boolean,
  ) { super(message); }
}
```

Internal to this module:
- `fetchGemini()` helper implementing the 401-retry pattern from §2.4.
- Exponential backoff + jitter on 429 (see §7.4).
- The two request body templates from §4.3 and §4.4 as typed constants.

6. **Create `src/llm/hydrate.ts`** with `hydrateTodos()` and `hydrateGanttTasks()` from §4.3/§4.4. Keep hydration separate from the API module so it can be unit-tested without network.

**Phase D: Settings integration**

7. **Extend `ProclivityState`** in `src/types/index.ts` to track connection state. Add a `geminiConnected: boolean` field (or derive it from `chrome.identity` at runtime — prefer derivation to avoid stale state). Since connection state is ephemeral (it lives in Chrome's token cache, not your storage), the UI should call `isConnected()` on mount rather than reading from storage.

8. **Add a `GeminiSection` to the Settings modal** (which is being built concurrently). The Settings modal (in `src/components/SettingsModal.tsx`) should render:

```
── AI Assistant ─────────────────────────────────────
  Google account: [not connected]
  [Connect Google Account]            (when disconnected)
  
  Google account: ✓ Connected
  [Disconnect]                         (when connected)
  
  Note: When connected, your text prompts are sent to
  Google's Gemini API. See Google's privacy policy.
──────────────────────────────────────────────────────
```

The "Connect Google Account" button calls `getToken({ interactive: true })`, then updates local state. "Disconnect" calls `disconnect()`.

9. **Wire connection state reactively** by calling `isConnected()` in the Settings modal's `useEffect` on open. No persistent storage needed — just component state.

**Phase E: LLM entry points in the UI**

10. **Today section — "Brainstorm tasks" button.** In `src/sections/Today.tsx`, add a button row below the existing "Add task" input. Label: "Brainstorm with Gemini". On click:
    - If not connected: show a small inline prompt: "Connect a Google account in Settings → AI Assistant first."
    - If connected: open a `TextInputModal` with placeholder "Describe what you want to accomplish…" and submit label "Generate tasks".
    - On submit: call `generateTodos(brief, { activeSprint, scope: "today" })`, then `hydrateTodos()`, then `update(s => ({ ...s, todos: [...s.todos, ...newTodos] }))`.
    - Show a loading spinner in the modal while awaiting; show the `GeminiError` message inline on failure.

11. **Gantt section — "Plan with Gemini" button.** In `src/sections/gantt/ChartView.tsx`, add a button to the `gantt-chart-header` div (alongside the existing Rename/Delete buttons). Label: "Plan with Gemini". Same connection check pattern. The `TextInputModal` prompt: "Describe your project and timeline…". On submit: call `generateGanttTasks(brief, { projectStart: new Date() })`, then `hydrateGanttTasks(items, chartId)`, then `update()` to append.

12. **Sprint section — "Add sprint tasks with Gemini".** (Optional, lower priority.) In `SprintManager.tsx`, when an active sprint is selected, add the brainstorm button with `scope: "sprint"` and `activeSprint` passed through.

**Phase F: Privacy guardrails**

13. **Never send the full `ProclivityState` to Gemini.** The system prompt receives only: today's date, whether a sprint is active (boolean), and the user's typed brief. No titles of existing tasks, no historical data, no IDs.

14. **Add a consent notice** at the top of every Gemini-triggered input modal:

```
"Your prompt will be sent to Google's Gemini API. 
 See Google's privacy policy."
```

Keep it one line, not an alarm — it's informational.

15. **Token length guard:** Before calling Gemini, check `brief.length`. If it exceeds 4,000 characters (~1,000 tokens), show an inline warning: "Brief is quite long — consider trimming it for better results." Allow the user to proceed regardless. This prevents accidental context blowout (e.g., user pastes a wall of text).

**Phase G: Error handling polish**

16. **Implement retry with backoff** in `fetchGemini()`:
    - On 429: wait `Math.min(2 ** attempt * 1000 + Math.random() * 500, 60_000)` ms, retry up to 3 times.
    - On 401: try the removeCachedAuthToken + re-getToken dance once (see §2.4). If it fails again, throw `GeminiError` with a "reconnect your account" message.
    - On 5xx: retry once after 2s.
    - On other errors: throw immediately.

17. **Graceful degradation:** If `isConnected()` returns false and `LanguageModel.availability()` returns `"readily"` or `"available"`, offer the on-device fallback (see §5). This is a stretch goal — implement after the cloud path is working.

**Phase H: Build verification**

18. **Update `src/types/index.ts`** if any new types are added (e.g., `GeminiTodoItem`, `GeminiGanttItem`). Ensure no `exactOptionalPropertyTypes` violations. All optional fields must be `?: T | undefined`.

19. **Run `npm run build`** — must pass `tsc -b && vite build` cleanly. The new `src/llm/` module does not import any new npm packages (only uses `chrome.identity` API and native `fetch`), so the initial chunk size constraint is not affected.

20. **Manual smoke test:** Load unpacked from `dist/`, open Settings, click "Connect Google Account", complete the Google OAuth consent, click "Brainstorm tasks", type a brief, verify tasks appear in the Today list.

---

## 7. Sharp Edges / Things to Watch

### 7.1 Extension ID Stability Across Reinstalls

The `key` field in `manifest.json` pins the extension ID to the RSA public key. This persists across:
- Unpacking/repacking
- Moving the dist directory to a different path
- Different developer machines (as long as the same `key` value is in the manifest)

If the `key` field is ever removed from the manifest (e.g., by mistake), the extension will get a new random ID, and the OAuth client ID registration will break. Guard against this with a comment in `manifest.config.ts`.

When distributing a packed `.crx`, Chrome Web Store strips the `key` field from the manifest but assigns its own stable ID based on the CRX signing key. Since this extension is not published, packed distribution is done by sharing the `.crx` file — Chrome will use the `key` field from the manifest inside it.

### 7.2 Token Expiry Mid-Session

`getAuthToken` returns access tokens with ~1 hour expiry. Chrome refreshes transparently. The case to handle is when the token is cached in Chrome but has been revoked server-side (user revokes at myaccount.google.com/permissions). Chrome does not know about server-side revocations. The Gemini API will return HTTP 401.

**Must implement the 401-retry pattern** from §2.4: on 401, call `removeCachedAuthToken`, then re-call `getAuthToken({ interactive: false })`. If the user revoked, `getAuthToken` will fail (no silent token available), and you should surface: "Your Google account authorization was revoked. Go to Settings → AI Assistant to reconnect."

### 7.3 Rate-Limit Handling (429s)

**Free tier (250 RPD for Flash):** At 10 RPM, the daily limit is exhausted in 25 minutes of sustained use. For a personal extension, this is virtually impossible in normal use. But if a bug causes a tight retry loop, it could burn through the daily quota.

**Implement the circuit breaker:** after 3 consecutive 429s within 5 minutes, disable LLM calls for the rest of the session and show a persistent banner: "Daily AI limit reached. Resets at midnight Pacific."

**RPM limit (10):** More likely to trigger if the user rapidly clicks "Generate" multiple times. Add a debounce: disable the Generate button for 10s after each successful call.

### 7.4 Consent Screen in Testing Status

Until the OAuth consent screen is published (which requires app verification for sensitive scopes), the app stays in "Testing" status. Consequences:

- Only test users (added in Cloud Console) can sign in.
- Access tokens for test users expire after **7 days** instead of the standard 1 hour (note: this contradicts the usual behavior — actually, *refresh tokens* are valid for 7 days in testing mode, after which the user must re-consent). Chrome handles refresh token rotation, but after 7 days the user will see the consent screen again.
- This is a non-issue for a personal extension where you are the only user.

### 7.5 CSP Rules in MV3 That Affect Fetch

MV3 extensions enforce a strict CSP that **bans remotely-hosted code** (no `eval`, no remote scripts). However, `fetch()` to external APIs is allowed from:

- The extension's **service worker** (no CSP restriction on fetch).
- Extension **pages** (new-tab page, popup) — subject to the extension's declared CSP, but `generativelanguage.googleapis.com` is in `host_permissions`, so fetch is allowed.

**Do NOT proxy the fetch through the service worker** unless you have a specific reason — calling Gemini directly from the React new-tab page's event handlers is fine and simpler.

**One CSP gotcha:** The new-tab page's CSP does not include `unsafe-eval` or `unsafe-inline`. The `chrome.identity.getAuthToken` call works fine (it's a Chrome API, not a script injection). But if you ever try to use a third-party JWT library that uses `eval` internally, it will fail. Use Chrome's built-in crypto APIs instead.

### 7.6 Cost Surprises from Long Prompts

A user who pastes a 10,000-word document as their "brief" will send ~2,500 tokens. At Flash pricing ($0.30/M input), this is $0.00075 — trivially cheap. But at 250 free-tier calls/day, they're burning through RPD fast. The 4,000-character soft warning from §6.4 is the right mitigation.

**The real cost risk** is a bug causing an infinite retry loop. The circuit breaker from §7.3 is the defense here.

### 7.7 Free Tier Data Used for Training

Free-tier prompts may be used to improve Google models. For a personal task manager, the data is not sensitive (task titles like "write blog post"). However, document this for the user in the Settings → AI Assistant section. The one-line consent notice in modals (§6.4) is sufficient.

If privacy matters more in future, the fix is to add billing and stay within pay-as-you-go — the paid tier explicitly does not use data for training.

### 7.8 @crxjs/vite-plugin Beta Stability

The project uses `@crxjs/vite-plugin ^2.0.0-beta.28`. Adding a `key` field and `oauth2` block to `defineManifest` is straightforward — `defineManifest` passes through arbitrary manifest fields. The callback form of `defineManifest` is documented and works with env variables. No known beta-version issue with these fields.

### 7.9 Gemini Nano Origin Trial Expiry

The Prompt API origin trial tokens expire. If you register for an origin trial to enable Gemini Nano in your extension, the trial token has an expiry date. Since the on-device path is a fallback (§5.7), expiry is non-critical — the fallback path will simply become unavailable and the cloud path remains the primary.

### 7.10 Schema Complexity Limits

Gemini's structured output `response_schema` has undocumented complexity limits — "oversized or deeply nested schemas may be rejected." The schemas in §4.3 and §4.4 are shallow (one level of nesting for the ARRAY of OBJECTs) and well within limits.

---

## 8. Verified Against

| URL | Date Accessed |
|---|---|
| [Chrome Extensions OAuth guide](https://developer.chrome.com/docs/extensions/how-to/integrate/oauth) | 2026-05-11 |
| [chrome.identity API reference](https://developer.chrome.com/docs/extensions/reference/api/identity) | 2026-05-11 (last updated 2026-01-07 per doc) |
| [Manifest key field reference](https://developer.chrome.com/docs/extensions/reference/manifest/key) | 2026-05-11 |
| [Gemini API OAuth quickstart](https://ai.google.dev/gemini-api/docs/oauth) | 2026-05-11 |
| [Gemini API structured outputs](https://ai.google.dev/gemini-api/docs/structured-output) | 2026-05-11 |
| [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) | 2026-05-11 |
| [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) | 2026-05-11 |
| [Gemini API billing](https://ai.google.dev/gemini-api/docs/billing) | 2026-05-11 |
| [Gemini 2.5 Flash model page](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash) | 2026-05-11 |
| [Chrome Prompt API](https://developer.chrome.com/docs/ai/prompt-api) | 2026-05-11 |
| [Structured output for Prompt API](https://developer.chrome.com/docs/ai/structured-output-for-prompt-api) | 2026-05-11 |
| [Clerk CRX ID guide](https://clerk.com/docs/guides/development/configure-consistent-crx-id) | 2026-05-11 |
| [aifreeapi.com free tier complete guide](https://www.aifreeapi.com/en/posts/gemini-api-free-tier-complete-guide) | 2026-05-11 (data as of March 2026) |
| [Gemini API structured output (apidog)](https://gemini-api.apidog.io/doc-965858) | 2026-05-11 |
| [tut_oauth MV3 source on GitHub](https://github.com/GoogleChrome/developer.chrome.com/blob/main/site/en/docs/extensions/mv3/tut_oauth/index.md) | 2026-05-11 |

---

*Generated 2026-05-11. Rate limits and OAuth consent screen behavior are subject to change — re-verify against AI Studio and Cloud Console before shipping.*
