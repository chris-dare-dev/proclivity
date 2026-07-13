/**
 * Photos workspace.
 *
 * Reads the cached photo set from `photosStore` (chrome.storage.local under
 * PHOTOS_STORAGE_KEY) and crossfades through it. Settings (interval, fit,
 * shuffle) come from ResolvedUserSettings.googlePhotos via useStore.
 *
 * Rendered as the Memory destination in the workspace. The empty state links
 * directly to Settings → Google Photos, and playback pauses whenever the
 * panel or browser tab is not visible.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useStore } from "@/storage/useStore";
import { OPEN_SETTINGS_EVENT, resolvedSettings } from "@/storage/constants";
import {
  EMPTY_PHOTOS_STATE,
  photosStore,
  type PhotosState,
} from "@/lib/googlePhotos/store";
import type { CachedPhoto } from "@/lib/googlePhotos/imageCache";
import "./photos.css";

interface PhotosProps {
  active?: boolean;
}

export function Photos({ active = true }: PhotosProps) {
  const { state } = useStore();
  const rs = useMemo(() => resolvedSettings(state.settings), [state.settings]);
  const intervalSec = rs.googlePhotos.slideshowIntervalSeconds;
  const displayMode = rs.googlePhotos.displayMode;
  const shuffle = rs.googlePhotos.shuffle;
  const reducedMotion = rs.reducedMotion;
  const [systemReducedMotion, setSystemReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const [photos, setPhotos] = useState<PhotosState>(EMPTY_PHOTOS_STATE);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [pageVisible, setPageVisible] = useState(
    () => document.visibilityState === "visible",
  );

  useEffect(() => {
    const onVisibilityChange = () =>
      setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) =>
      setSystemReducedMotion(event.matches);
    setSystemReducedMotion(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const motionReduced = reducedMotion || systemReducedMotion;
  const playing = active && pageVisible && !paused && !motionReduced;

  // Load + subscribe to the photo cache.
  useEffect(() => {
    let mounted = true;
    void photosStore.get().then((s) => {
      if (mounted) setPhotos(s);
    });
    const unsub = photosStore.subscribe((s) => {
      if (mounted) {
        setPhotos(s);
        // Reset to 0 whenever the set changes so we never index past the end.
        setIndex(0);
      }
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  // Stable display order: shuffle is computed once per render of the photo
  // set rather than per slide tick (Fisher-Yates over a copy).
  const ordered: ReadonlyArray<CachedPhoto> = useMemo(() => {
    if (!shuffle) return photos.photos;
    const copy = photos.photos.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const ci = copy[i];
      const cj = copy[j];
      if (ci !== undefined && cj !== undefined) {
        copy[i] = cj;
        copy[j] = ci;
      }
    }
    return copy;
    // Reshuffle whenever the underlying set or the shuffle flag changes.
  }, [photos.photos, shuffle]);

  // Slide ticker. Pauses when only 0 or 1 photo is cached.
  const tickRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (tickRef.current !== undefined) {
      window.clearInterval(tickRef.current);
      tickRef.current = undefined;
    }
    if (ordered.length < 2 || !playing) return;
    const ms = Math.max(3000, intervalSec * 1000);
    tickRef.current = window.setInterval(() => {
      setIndex((i) => (i + 1) % ordered.length);
    }, ms);
    return () => {
      if (tickRef.current !== undefined) {
        window.clearInterval(tickRef.current);
        tickRef.current = undefined;
      }
    };
  }, [intervalSec, ordered, playing]);

  // Imperatively play the active video and pause every other one whenever
  // the index or set changes. Done in an effect (not declarative props) so
  // we can drive HTMLVideoElement.play()/.pause() without relying on the
  // `autoplay` attribute, which would fire all videos on mount.
  //
  // Under user- or system-requested reduced motion the active video stays
  // paused (first frame visible);
  // looping autoplay video qualifies as "motion" by the same yardstick we
  // already use to disable the crossfade transition.
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const activeVideoIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const activeId = ordered[index]?.id;
    const slideChanged = activeVideoIdRef.current !== activeId;
    videoRefs.current.forEach((el, id) => {
      if (id === activeId && playing) {
        if (slideChanged) el.currentTime = 0;
        // play() returns a promise that rejects if autoplay is blocked or
        // the element is paused mid-flight — we don't care to surface either.
        void el.play().catch(() => undefined);
      } else {
        el.pause();
      }
    });
    activeVideoIdRef.current = activeId;
  }, [index, ordered, playing]);

  if (ordered.length === 0) {
    return (
      <div className="photos-empty">
        <div className="photos-empty__eyebrow">Memory workspace</div>
        <h2>Photos are not set up.</h2>
        <p>
          Connect Google Photos and choose the items you want cached locally in
          this extension.
        </p>
        <button
          type="button"
          className="photos-empty__action"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent(OPEN_SETTINGS_EVENT, { detail: "googlePhotos" }),
            )
          }
        >
          Open Google Photos settings
        </button>
      </div>
    );
  }

  const current = ordered[index];
  if (!current) return null;

  return (
    <div
      className="photos-stage"
      aria-label="Photo slideshow"
      data-display-mode={displayMode}
      data-reduced-motion={motionReduced ? "true" : undefined}
    >
      {ordered.map((p, i) => {
        const className = `photos-slide${i === index ? " is-active" : ""}`;
        const ariaHidden = i === index ? undefined : true;
        if (p.kind === "video") {
          return (
            <video
              key={p.id}
              ref={(el) => {
                if (el) {
                  videoRefs.current.set(p.id, el);
                } else {
                  videoRefs.current.delete(p.id);
                }
              }}
              src={p.dataUrl}
              className={className}
              aria-hidden={ariaHidden}
              aria-label={p.filename}
              muted
              playsInline
              loop
              preload="metadata"
            />
          );
        }
        return (
          <img
            key={p.id}
            src={p.dataUrl}
            alt={p.filename}
            className={className}
            // Off-screen slides are hidden from a11y tree.
            aria-hidden={ariaHidden}
          />
        );
      })}
      <div className="photos-caption">
        <span className="photos-counter">
          {index + 1} / {ordered.length}
        </span>
        <span className="photos-filename">{current.filename}</span>
        {ordered.length > 1 && !motionReduced && (
          <button
            type="button"
            className="photos-playback"
            aria-label={paused ? "Play slideshow" : "Pause slideshow"}
            aria-pressed={!paused}
            onClick={() => setPaused((currentPaused) => !currentPaused)}
          >
            {paused ? (
              <Play size={14} aria-hidden="true" />
            ) : (
              <Pause size={14} aria-hidden="true" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default Photos;
