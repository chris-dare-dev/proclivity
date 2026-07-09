import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// `vi.mock` is hoisted above the imports, so the mutable store state it closes
// over must be created with `vi.hoisted` (a plain `const` would be in the TDZ).
const h = vi.hoisted(() => ({
  state: { host: "http://127.0.0.1:27123", apiKey: "deadbeef" },
}));
vi.mock("@/lib/roadmap/store", () => ({
  roadmapStore: { get: async () => h.state },
}));

import { handleObsidianMessage } from "./obsidianProxy";

const JOURNAL = "Source Code/proclivity/plans/gemini-nano/progress/proclivity.jsonl";
const URL_ENC =
  "http://127.0.0.1:27123/vault/Source%20Code/proclivity/plans/gemini-nano/progress/proclivity.jsonl";
const L1 = '{"id":"gemini-nano-spike-1","field":"status","value":"done"}\n';
const L2 = '{"id":"gemini-nano-spike-2","field":"status","value":"done"}\n';

const fetchMock = vi.fn();

beforeEach(() => {
  h.state = { host: "http://127.0.0.1:27123", apiKey: "deadbeef" };
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

/** The `init` object of the Nth fetch call (0-indexed). */
function initOf(n: number): RequestInit {
  return fetchMock.mock.calls[n]?.[1] as RequestInit;
}

describe("handleObsidianMessage — append", () => {
  it("creates the journal when it does not exist yet (GET 404 → PUT the bare line)", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const res = await handleObsidianMessage({
      type: "obsidian:append",
      relPath: JOURNAL,
      line: L1,
    });

    expect(res).toEqual({ ok: true, status: 204, body: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Both legs hit the same %20-encoded URL.
    expect(fetchMock.mock.calls[0]?.[0]).toBe(URL_ENC);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(URL_ENC);
    expect(initOf(1).method).toBe("PUT");
    expect(initOf(1).body).toBe(L1);
  });

  it("PRESERVES prior lines on a second append (regression: POST truncated the journal)", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(L1, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const res = await handleObsidianMessage({
      type: "obsidian:append",
      relPath: JOURNAL,
      line: L2,
    });

    expect(res.ok).toBe(true);
    // The whole file is rewritten — but with BOTH events, not just the newest.
    expect(initOf(1).body).toBe(L1 + L2);
    expect(String(initOf(1).body).trimEnd().split("\n")).toHaveLength(2);
  });

  it("inserts a separator when the existing journal lacks a trailing newline", async () => {
    const unterminated = '{"id":"a","field":"status","value":"done"}';
    fetchMock
      .mockResolvedValueOnce(new Response(unterminated, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await handleObsidianMessage({
      type: "obsidian:append",
      relPath: JOURNAL,
      line: L2,
    });

    expect(initOf(1).body).toBe(`${unterminated}\n${L2}`);
  });

  it("sends bearer auth and a text/* content type the plugin will parse to a string body", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await handleObsidianMessage({
      type: "obsidian:append",
      relPath: JOURNAL,
      line: L1,
    });

    const putHeaders = initOf(1).headers as Record<string, string>;
    expect(putHeaders["Authorization"]).toBe("Bearer deadbeef");
    // A non-text/* type makes the plugin reject with 40010.
    expect(putHeaders["Content-Type"]).toBe("text/markdown");
  });

  it("does NOT write when the read leg fails (no clobbering on a transient 500)", async () => {
    fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }));

    const res = await handleObsidianMessage({
      type: "obsidian:append",
      relPath: JOURNAL,
      line: L1,
    });

    expect(res.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1); // GET only — PUT never issued.
  });

  it("surfaces a failed write leg so the caller leaves its cursor unchanged", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response("nope", { status: 405 }));

    const res = await handleObsidianMessage({
      type: "obsidian:append",
      relPath: JOURNAL,
      line: L1,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(405);
  });
});

describe("handleObsidianMessage — read", () => {
  it("maps 404 to a null body rather than an error (no compiled roadmap yet)", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    const res = await handleObsidianMessage({
      type: "obsidian:read",
      relPath: "Projects/Proclivity/Roadmaps/gemini-nano/roadmap.compiled.json",
    });
    expect(res).toEqual({ ok: true, status: 404, body: null });
  });

  it("returns the body on 200", async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"items":[]}', { status: 200 }));
    const res = await handleObsidianMessage({
      type: "obsidian:read",
      relPath: "x.json",
    });
    expect(res).toEqual({ ok: true, status: 200, body: '{"items":[]}' });
  });

  it("reports a network rejection as status 0", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Failed to fetch"));
    const res = await handleObsidianMessage({
      type: "obsidian:read",
      relPath: "x.json",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(0);
      expect(res.message).toContain("Failed to fetch");
    }
  });
});

describe("handleObsidianMessage — configuration", () => {
  it("refuses to call out when the host/key are unset", async () => {
    h.state = { host: "", apiKey: "" };
    const res = await handleObsidianMessage({
      type: "obsidian:append",
      relPath: JOURNAL,
      line: L1,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
