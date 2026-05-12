import { useEffect } from "react";
import type { UserSettings } from "@/types";
import { resolvedSettings } from "@/storage/constants";

/**
 * Applies the resolved settings to data-* attributes and inline custom
 * properties on `<html>` so the theme system stays in sync with state.
 *
 * Subscribes to `prefers-color-scheme` while theme === "system" so the
 * page tracks OS changes without a refresh.
 *
 * Called once near the top of the React tree (App.tsx).
 */
export function useThemeSync(settings: UserSettings): void {
  const rs = resolvedSettings(settings);

  useEffect(() => {
    const html = document.documentElement;

    // ── Theme ────────────────────────────────────────────────
    const resolvedTheme: "light" | "dark" =
      rs.theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : rs.theme;
    html.setAttribute("data-theme", resolvedTheme);

    // ── Density ─────────────────────────────────────────────
    if (rs.density === "default") {
      html.removeAttribute("data-density");
    } else {
      html.setAttribute("data-density", rs.density);
    }

    // ── Font size ───────────────────────────────────────────
    if (rs.fontSize === "md") {
      html.removeAttribute("data-font-size");
    } else {
      html.setAttribute("data-font-size", rs.fontSize);
    }

    // ── Reduced motion (user OR OS, never user-disables-OS) ─
    const osReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (rs.reducedMotion || osReducedMotion) {
      html.setAttribute("data-reduced-motion", "true");
    } else {
      html.removeAttribute("data-reduced-motion");
    }

    // ── Accent color (inline custom property override) ──────
    html.style.setProperty("--accent", rs.accentColor);
  }, [
    rs.theme,
    rs.density,
    rs.fontSize,
    rs.reducedMotion,
    rs.accentColor,
  ]);

  // System-theme tracking: re-render through state? No — we mutate the
  // DOM attribute directly, since this is a styling concern and not
  // worth a re-render storm on every OS theme flip.
  useEffect(() => {
    if (rs.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.setAttribute(
        "data-theme",
        e.matches ? "dark" : "light",
      );
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [rs.theme]);

  // Same idea for reduced-motion: keep the data-reduced-motion attribute
  // in sync with OS changes when the user hasn't explicitly set the flag.
  useEffect(() => {
    if (rs.reducedMotion) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) {
        document.documentElement.setAttribute("data-reduced-motion", "true");
      } else {
        document.documentElement.removeAttribute("data-reduced-motion");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [rs.reducedMotion]);
}
