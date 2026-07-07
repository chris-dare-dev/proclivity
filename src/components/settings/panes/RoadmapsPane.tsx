/**
 * RoadmapsPane — connect to an Obsidian vault via the Local REST API, register
 * roadmap sources, sync them into native-looking Todos + a Gantt chart, and
 * (via the App.tsx write-back detector) append task completion back to the
 * vault progress journal.
 *
 * Live state subscribes to `roadmapStore` directly (like GooglePhotosPane →
 * photosStore) because host / API key / sources / write-back cursor live under
 * their own chrome.storage key, deliberately OUT of the main ProclivityState
 * tree and the export blob — the API key must never land in a backup.
 *
 * Non-secret prefs (default scope, gantt surfacing, auto-sync) DO live in
 * UserSettings and use the immediate-persist `live()` updater from
 * SettingsModal. `sync.ts` (which statically pulls the heavy `ingest.ts`) is
 * dynamic-imported only on the Sync-now click, keeping it out of the lazy
 * Settings chunk's static graph.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { SegmentedControl, ToggleSwitch } from "../SettingsControls";
import {
  EMPTY_ROADMAP_STATE,
  roadmapStore,
  srcKeyOf,
} from "@/lib/roadmap/store";
import {
  derivePaths,
  readCompiled,
  testConnection,
} from "@/lib/roadmap/client";
import type { RoadmapSource, RoadmapStoreState } from "@/lib/roadmap/types";
import type { TodoScope, UserSettings } from "@/types";

interface LiveUpdater {
  <K extends keyof UserSettings>(key: K, value: UserSettings[K]): void;
}

/** Inline guidance shown when the host is not a grantable 127.0.0.1 origin. */
const HOST_HELP = "Chrome only grants 127.0.0.1; use http://127.0.0.1:27123";

/**
 * Validate + normalize the Obsidian host. `host_permissions` grants only
 * `http://127.0.0.1/*`, and Chrome match patterns do NOT resolve `localhost`
 * or any other hostname — a non-127.0.0.1 host would silently CORS-fail. Accept
 * ONLY `http://127.0.0.1` with an optional port; reject everything else so we
 * never persist a host that cannot work.
 */
function normalizeHost(raw: string): { host: string } | { error: string } {
  const host = raw.trim().replace(/\/+$/, "");
  if (!/^http:\/\/127\.0\.0\.1(:\d{1,5})?$/.test(host)) {
    return { error: HOST_HELP };
  }
  return { host };
}

export interface RoadmapsPaneProps {
  live: LiveUpdater;
  prefs: {
    defaultScope: TodoScope;
    surfaceInGantt: boolean;
    autoSyncOnOpen: boolean;
  };
  /** True when the Long-term section is hidden — drives the scope nudge. */
  longTermHidden: boolean;
}

type Busy = "idle" | "testing" | "adding" | "syncing";

export function RoadmapsPane({ live, prefs, longTermHidden }: RoadmapsPaneProps) {
  const [store, setStore] = useState<RoadmapStoreState>(EMPTY_ROADMAP_STATE);
  const seededRef = useRef(false);
  const [hostInput, setHostInput] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [repoInput, setRepoInput] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [busy, setBusy] = useState<Busy>("idle");
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [addMsg, setAddMsg] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // Live-subscribe to the roadmap store; seed the editable host/key inputs
  // once from the first load so later live updates don't clobber typing.
  useEffect(() => {
    let mounted = true;
    void roadmapStore.get().then((s) => {
      if (!mounted) return;
      setStore(s);
      if (!seededRef.current) {
        setHostInput(s.host);
        setKeyInput(s.apiKey);
        seededRef.current = true;
      }
    });
    const unsub = roadmapStore.subscribe((s) => {
      if (mounted) setStore(s);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const onSaveConnection = useCallback(async () => {
    setTestMsg(null);
    const v = normalizeHost(hostInput);
    if ("error" in v) {
      setTestMsg(v.error);
      return;
    }
    await roadmapStore.patch(() => ({ host: v.host, apiKey: keyInput.trim() }));
    setHostInput(v.host);
    setTestMsg("Saved.");
  }, [hostInput, keyInput]);

  const onTest = useCallback(async () => {
    setTestMsg(null);
    const v = normalizeHost(hostInput);
    if ("error" in v) {
      setTestMsg(v.error);
      return;
    }
    setBusy("testing");
    // Persist normalized inputs first so the SW reads the values under test.
    await roadmapStore.patch(() => ({ host: v.host, apiKey: keyInput.trim() }));
    setHostInput(v.host);
    const r = await testConnection();
    setBusy("idle");
    setTestMsg(
      r.ok
        ? "Connected — the vault answered and the API key was accepted."
        : `Failed (${r.status || "network"}): ${r.message}`,
    );
  }, [hostInput, keyInput]);

  const onAddRoadmap = useCallback(async () => {
    const repo = repoInput.trim();
    const slug = slugInput.trim();
    if (!repo || !slug) {
      setAddMsg("Enter both a repo and a slug.");
      return;
    }
    if (store.sources.some((s) => s.repo === repo && s.slug === slug)) {
      setAddMsg("That roadmap is already added.");
      return;
    }
    setBusy("adding");
    setAddMsg(null);
    try {
      const compiled = await readCompiled({ repo, slug });
      if (!compiled) {
        const { compiledPath } = derivePaths(repo, slug);
        setAddMsg(`No compiled roadmap found at "${compiledPath}".`);
        setBusy("idle");
        return;
      }
      const source: RoadmapSource = {
        repo,
        slug,
        title: compiled.title,
        enabled: true,
      };
      await roadmapStore.patch((cur) => ({
        sources: [...cur.sources, source],
      }));
      setRepoInput("");
      setSlugInput("");
      setAddMsg(`Added "${compiled.title}" — run Sync now to ingest it.`);
    } catch (e) {
      setAddMsg(e instanceof Error ? e.message : String(e));
    }
    setBusy("idle");
  }, [repoInput, slugInput, store.sources]);

  const onToggleSource = useCallback(
    async (source: RoadmapSource, enabled: boolean) => {
      await roadmapStore.patch((cur) => ({
        sources: cur.sources.map((s) =>
          s.repo === source.repo && s.slug === source.slug
            ? { ...s, enabled }
            : s,
        ),
      }));
    },
    [],
  );

  const onRemoveSource = useCallback(async (source: RoadmapSource) => {
    // Removing a source only drops its config. Its already-ingested mirror
    // todos / gantt records are left in place (they simply stop updating) so
    // this never destroys anything the user may have interacted with.
    await roadmapStore.patch((cur) => ({
      sources: cur.sources.filter(
        (s) => !(s.repo === source.repo && s.slug === source.slug),
      ),
    }));
  }, []);

  const onSyncNow = useCallback(async () => {
    setBusy("syncing");
    setSyncMsg(null);
    try {
      const mod = await import("@/lib/roadmap/sync");
      const result = await mod.syncNow();
      if (result.sources === 0) {
        setSyncMsg("No enabled roadmaps to sync.");
      } else if (result.ok) {
        setSyncMsg(`Synced ${result.synced} roadmap(s).`);
      } else {
        setSyncMsg(
          `Synced ${result.synced}/${result.sources}; errors: ${result.errors.join(
            " | ",
          )}`,
        );
      }
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : String(e));
    }
    setBusy("idle");
  }, []);

  const setPref = useCallback(
    (partial: Partial<RoadmapsPaneProps["prefs"]>) => {
      live("roadmap", {
        defaultScope: prefs.defaultScope,
        surfaceInGantt: prefs.surfaceInGantt,
        autoSyncOnOpen: prefs.autoSyncOnOpen,
        ...partial,
      });
    },
    [live, prefs.defaultScope, prefs.surfaceInGantt, prefs.autoSyncOnOpen],
  );

  return (
    <div
      role="tabpanel"
      id="settings-pane-roadmaps"
      aria-labelledby="settings-tab-roadmaps"
      className="settings-pane"
    >
      <section className="settings-section">
        <h3 className="settings-section-heading">Obsidian connection</h3>
        <p className="settings-hint" style={{ marginTop: 0 }}>
          Roadmaps are read from your Obsidian vault through the{" "}
          <strong>Local REST API</strong> plugin. Enable its non-encrypted HTTP
          server (default <code>http://127.0.0.1:27123</code>) and paste the
          generated API key. Everything runs locally — nothing leaves your
          machine.
        </p>

        <div className="settings-field">
          <label htmlFor="roadmap-host" className="settings-label">
            Host
          </label>
          <input
            id="roadmap-host"
            type="text"
            spellCheck={false}
            autoComplete="off"
            placeholder="http://127.0.0.1:27123"
            value={hostInput}
            onChange={(e) => setHostInput(e.target.value)}
          />
        </div>

        <div className="settings-field">
          <label htmlFor="roadmap-key" className="settings-label">
            API key
          </label>
          <input
            id="roadmap-key"
            type="password"
            spellCheck={false}
            autoComplete="off"
            placeholder="Obsidian Local REST API bearer token"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
          />
        </div>

        <div className="settings-row">
          <button type="button" onClick={() => void onSaveConnection()}>
            Save
          </button>
          <button
            type="button"
            onClick={() => void onTest()}
            disabled={busy !== "idle"}
          >
            {busy === "testing" ? "Testing…" : "Test connection"}
          </button>
        </div>
        {testMsg && (
          <p className="settings-hint" role="status" style={{ marginTop: 8 }}>
            {testMsg}
          </p>
        )}
      </section>

      <section className="settings-section">
        <h3 className="settings-section-heading">Roadmaps</h3>
        <p className="settings-hint" style={{ marginTop: 0 }}>
          Add a roadmap by its repo folder and slug (e.g. <code>arXMCP</code> /{" "}
          <code>paper-metadata</code>). Adding validates that the compiled
          roadmap file is readable before saving it.
        </p>

        <div className="settings-row">
          <input
            type="text"
            aria-label="Repo"
            spellCheck={false}
            autoComplete="off"
            placeholder="repo (e.g. arXMCP)"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
          />
          <input
            type="text"
            aria-label="Slug"
            spellCheck={false}
            autoComplete="off"
            placeholder="slug (e.g. paper-metadata)"
            value={slugInput}
            onChange={(e) => setSlugInput(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void onAddRoadmap()}
            disabled={busy !== "idle"}
          >
            {busy === "adding" ? "Adding…" : "Add roadmap"}
          </button>
        </div>
        {addMsg && (
          <p className="settings-hint" role="status" style={{ marginTop: 8 }}>
            {addMsg}
          </p>
        )}

        {store.sources.length > 0 ? (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              marginTop: 12,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {store.sources.map((s) => (
              <li
                key={srcKeyOf(s)}
                className="settings-row"
                style={{ alignItems: "center", justifyContent: "space-between" }}
              >
                <span>
                  <strong>{s.title ?? s.slug}</strong>{" "}
                  <code className="settings-hint">{srcKeyOf(s)}</code>
                </span>
                <span className="settings-row" style={{ alignItems: "center" }}>
                  <label className="settings-hint">
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      onChange={(e) =>
                        void onToggleSource(s, e.target.checked)
                      }
                    />{" "}
                    Enabled
                  </label>
                  <button type="button" onClick={() => void onRemoveSource(s)}>
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="settings-hint" style={{ marginTop: 12 }}>
            No roadmaps added yet.
          </p>
        )}

        <div className="settings-row" style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => void onSyncNow()}
            disabled={busy !== "idle"}
          >
            {busy === "syncing" ? "Syncing…" : "Sync now"}
          </button>
        </div>
        {syncMsg && (
          <p className="settings-hint" role="status" style={{ marginTop: 8 }}>
            {syncMsg}
          </p>
        )}
        <dl className="settings-hint" style={{ marginTop: 8 }}>
          <dt>Last sync</dt>
          <dd>
            {store.lastSyncAt
              ? new Date(store.lastSyncAt).toLocaleString()
              : "never"}
            {store.lastSyncError ? ` · error: ${store.lastSyncError}` : ""}
          </dd>
        </dl>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-heading">Ingest preferences</h3>

        <SegmentedControl<TodoScope>
          name="settings-roadmap-scope"
          legend="Default scope for ingested tasks"
          options={[
            { value: "today", label: "Today" },
            { value: "sprint", label: "Sprint" },
            { value: "long", label: "Long-term" },
          ]}
          value={prefs.defaultScope}
          onChange={(v) => setPref({ defaultScope: v })}
          hint="Where ingested task / spike items land. Epics and milestones only appear on the Gantt chart."
        />

        {prefs.defaultScope === "long" && longTermHidden && (
          <p className="settings-hint" role="status">
            Long-term is currently hidden. Re-enable it in Settings → General so
            ingested items are visible.
          </p>
        )}

        <ToggleSwitch
          label="Show roadmaps on the Gantt chart"
          checked={prefs.surfaceInGantt}
          onChange={(v) => setPref({ surfaceInGantt: v })}
          hint="When off, roadmap Gantt charts and bars are pruned on the next sync."
        />

        <ToggleSwitch
          label="Auto-sync when a new tab opens"
          checked={prefs.autoSyncOnOpen}
          onChange={(v) => setPref({ autoSyncOnOpen: v })}
          hint="Off by default so opening a new tab never waits on a vault fetch. Sync manually with the button above."
        />
      </section>
    </div>
  );
}
