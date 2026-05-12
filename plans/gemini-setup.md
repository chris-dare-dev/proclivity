# Gemini integration — one-time setup

This doc is for the **developer** of Proclivity (single user, you). It walks the one-time setup required before any Gemini-touching milestone (`gemini-m2`, `gemini-m3`, …) can wire up real network calls.

You only need to do this once per machine. The output is:

1. A stable Chrome extension ID derived from a checked-in public key.
2. A Google Cloud OAuth 2.0 Client ID of type "Chrome Extension" bound to that ID.
3. The `oauth2.client_id` value in `manifest.config.ts` updated from its placeholder to the real Client ID.

The full theory of why these steps exist is in [plans/gemini-integration-research.md](gemini-integration-research.md) §1.

---

## Prerequisites

- A Google account you're willing to attach OAuth to (a personal account is fine — Google Workspace is not required).
- `openssl` on PATH (macOS ships it; `openssl version` should print something).
- `node` ≥ 22 and `npm` (already needed for `npm run build`).

---

## 1. Generate the RSA key pair

The private key stays on your machine forever. The public key is committed in `manifest.config.ts` so Chrome can derive the same extension ID across reinstalls.

```bash
# from the repo root
openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out .proclivity-key.pem
```

This produces a PKCS8-format private key, matching the convention used in [`plans/gemini-integration-research.md`](gemini-integration-research.md) §1.3. PKCS8 and the older PKCS1 format (`openssl genrsa -out …`) produce **identical public keys** when exported with `-pubout -outform DER`, so the derived extension ID is the same either way — but standardizing on PKCS8 keeps this doc consistent with the research doc and avoids confusion if you later cross-reference the two.

`.proclivity-key.pem` is in `.gitignore` (via the `*.pem` rule) — verify with `git status` that it does NOT appear.

### Derive the Base64 public key (for the manifest `key` field)

```bash
openssl rsa -in .proclivity-key.pem -pubout -outform DER 2>/dev/null \
  | base64 \
  | tr -d '\n'
```

The output is a single ~388-character Base64 string with no line breaks. This is what `manifest.config.ts` already has hard-coded as the `key` field. If you ever **rotate the key**, replace that string with this command's output and also re-register the OAuth Client ID in step 3 (the extension ID will change).

### Derive the stable extension ID (for GCP Console step 3)

Chrome derives the extension ID as the first 16 bytes of `SHA-256(DER public key)`, then maps each hex digit `0-9a-f` to `a-p`:

```bash
openssl rsa -in .proclivity-key.pem -pubout -outform DER 2>/dev/null \
  | openssl dgst -sha256 -binary \
  | xxd -p -c 32 \
  | head -c 32 \
  | tr '0-9a-f' 'a-p'
```

Save this 32-character string — you'll paste it into Google Cloud Console in step 3, and you'll verify it again in step 4.

---

## 2. Create a Google Cloud project + enable the Gemini API

These steps happen entirely in your browser at <https://console.cloud.google.com>.

### 2.1. Create or pick a project

- Top-left project picker → **New Project** if you don't already have one.
- Name: anything (e.g. `proclivity-personal`). Region/org: leave defaults.
- Wait for the project to be created (~10 seconds), then make sure it's selected in the picker.

### 2.2. Enable the Generative Language API

- Hamburger menu → **APIs & Services** → **Library**.
- Search for **"Generative Language API"** (full string).
- Click the result → **Enable**.
- Wait until the page redirects to the API's overview ("API enabled" badge appears).

### 2.3. Configure the OAuth consent screen

- **APIs & Services** → **OAuth consent screen**.
- User type: **External**. (Internal requires Google Workspace; not what you have.) Click **Create**.
- App information:
  - **App name**: `Proclivity` (or whatever you want — only you will see it).
  - **User support email**: your email.
  - **Developer contact**: your email.
- On the **Scopes** page, click **Add or Remove Scopes** → in the filter, paste `https://www.googleapis.com/auth/generative-language.retriever` → tick the matching row → click **Update**. (If you can't find it via the filter, scroll the list under "Generative Language API". The scope must be added here so Google can populate the consent dialog when `chrome.identity.getAuthToken({ interactive: true })` first runs — skipping this step is the most common reason for a blank or "unregistered scope" consent flow.) → **Save and Continue**.
- Skip the Optional info page → **Save and Continue**.
- Land on the **Summary** page.
- Go to **Test users** in the left rail → **Add users** → add your own Google account email → **Save**.

Status will be **Testing** — that's correct for personal use. Do NOT publish.

---

## 3. Create the Chrome Extension OAuth Client ID

- **APIs & Services** → **Credentials**.
- **+ Create Credentials** → **OAuth client ID**.
- Application type: **Chrome Extension**.
- Name: `Proclivity (unpacked)` or similar.
- **Application ID** (also called Item ID): paste the 32-character extension ID you derived in §1.
- **Create**.

A dialog appears with your new **Client ID** — a string like `123456789-abc….apps.googleusercontent.com`. Copy it now (it's also visible in the Credentials list afterward).

### Paste the Client ID into `manifest.config.ts`

Open [manifest.config.ts](../manifest.config.ts). Find the line:

```ts
const OAUTH_CLIENT_ID_PLACEHOLDER =
  "REPLACE_WITH_GCP_CLIENT_ID.apps.googleusercontent.com";
```

Replace the placeholder string with your real Client ID. Save.

Rebuild:

```bash
npm run build
```

The emitted `dist/manifest.json` now has `oauth2.client_id` set to your real Client ID.

---

## 4. Verify the extension ID actually matches

The whole point of the `key` field is making `chrome://extensions` show the **same** ID you computed in §1. If they don't match, the OAuth Client ID won't recognize the extension.

```bash
npm run build
```

Then in Chrome:

1. Go to `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle) if it isn't already.
3. **Load unpacked** → select the `dist/` folder.
4. Find the Proclivity card. The **ID** field shows the extension ID.

It should be **exactly** the 32 characters you computed via the openssl pipeline in §1. If it doesn't match:

- Verify `manifest.config.ts`'s `key` field hasn't been edited.
- Re-run the public-key Base64 derivation and confirm it produces the same string.
- Re-run the extension-ID derivation pipeline; the `tr '0-9a-f' 'a-p'` step is the most common place to introduce a typo.

---

## 5. (Optional) Smoke-test the OAuth flow

This is the manual equivalent of `gemini-spike-1`. Skip if you'd rather wait for `gemini-m2` to land a "Connect Google account" button.

Open a console on any extension page (`chrome://extensions` → Proclivity → **Inspect views** → `service worker` or `index.html`) and run:

```js
chrome.identity.getAuthToken({ interactive: true }, (token) => {
  console.log("token:", token?.slice(0, 16) + "…");
});
```

You should see the Google consent dialog (first time only), and then a token logged. If you get a "bad client id" error, the Item ID in GCP Console doesn't match the extension ID Chrome is seeing — go back to §3 and re-check.

---

## Rotation / regeneration

If `.proclivity-key.pem` is ever lost or you want to rotate it:

1. Re-run §1 to produce a fresh keypair and a new extension ID.
2. Update the `key` field in `manifest.config.ts`.
3. Re-do §3 (the old OAuth Client ID is still valid in GCP but bound to the old extension ID, which no longer exists in your `chrome://extensions`). Create a new Client ID against the new ID, paste it in, rebuild.

There is no "key recovery" — the private PEM is the only source of the public key string.

---

## Open question — scope coverage

The `oauth2.scopes` array in `manifest.config.ts` currently lists only `https://www.googleapis.com/auth/generative-language.retriever`. Per [plans/gemini-integration-research.md](gemini-integration-research.md) §3.2, that scope's coverage of the `generateContent` endpoint is **not documented**. If `gemini-spike-1` (or the first real call in `gemini-m3`) returns a `403 Forbidden`, the fix is to add `https://www.googleapis.com/auth/cloud-platform` to the scope list and rebuild.

The reason we don't ship `cloud-platform` upfront: it's a broader consent dialog and the narrower scope works for many users. Start narrow, widen if Chrome surfaces an auth error.
