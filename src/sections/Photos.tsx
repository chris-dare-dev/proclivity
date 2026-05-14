/**
 * Photos slideshow banner.
 *
 * Reads the cached photo set from `photosStore` (chrome.storage.local under
 * PHOTOS_STORAGE_KEY) and crossfades through it. Settings (interval, fit,
 * shuffle) come from ResolvedUserSettings.googlePhotos via useStore.
 *
 * Rendered as a banner above the dashboard tab bar. Returns `null` when no
 * photos are cached so the slot doesn't show a permanent empty placeholder
 * — the connect / pick affordances live in Settings → Google Photos.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/storage/useStore";
import { resolvedSettings } from "@/storage/constants";
import {
  EMPTY_PHOTOS_STATE,
  photosStore,
  type PhotosState,
} from "@/lib/googlePhotos/store";
import type { CachedPhoto } from "@/lib/googlePhotos/imageCache";
import "./photos.css";

export function Photos() {
  const { state } = useStore();
  const rs = useMemo(() => resolvedSettings(state.settings), [state.settings]);
  const intervalSec = rs.googlePhotos.slideshowIntervalSeconds;
  const displayMode = rs.googlePhotos.displayMode;
  const shuffle = rs.googlePhotos.shuffle;
  const reducedMotion = rs.reducedMotion;

  const [photos, setPhotos] = useState<PhotosState>(EMPTY_PHOTOS_STATE);
  const [index, setIndex] = useState(0);

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
    if (ordered.length < 2) return;
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
  }, [ordered, intervalSec]);

  // Imperatively play the active video and pause every other one whenever
  // the index or set changes. Done in an effect (not declarative props) so
  // we can drive HTMLVideoElement.play()/.pause() without relying on the
  // `autoplay` attribute, which would fire all videos on mount.
  //
  // Under reducedMotion the active video stays paused (first frame visible);
  // looping autoplay video qualifies as "motion" by the same yardstick we
  // already use to disable the crossfade transition.
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  useEffect(() => {
    const activeId = ordered[index]?.id;
    videoRefs.current.forEach((el, id) => {
      if (id === activeId && !reducedMotion) {
        el.currentTime = 0;
        // play() returns a promise that rejects if autoplay is blocked or
        // the element is paused mid-flight — we don't care to surface either.
        void el.play().catch(() => undefined);
      } else {
        el.pause();
      }
    });
  }, [index, ordered, reducedMotion]);

  if (ordered.length === 0) return null;

  const current = ordered[index];
  if (!current) return null;

  return (
    <div
      className="photos-stage"
      aria-label="Photo slideshow"
      data-display-mode={displayMode}
      data-reduced-motion={reducedMotion ? "true" : undefined}
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
      <div className="photos-caption" role="status" aria-live="polite">
        <span className="photos-counter">
          {index + 1} / {ordered.length}
        </span>
        <span className="photos-filename">{current.filename}</span>
      </div>
    </div>
  );
}

export default Photos;
