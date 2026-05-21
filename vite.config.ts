import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import path from "node:path";
import manifest from "./manifest.config";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // m11 rect L3: npm hoists @radix-ui/react-primitive and @radix-ui/react-slot
    // at multiple versions due to cmdk's nested-dep tree (one copy at the top
    // level, additional copies nested inside other Radix peers that lock to
    // older minors). Without dedupe, Vite bundles each unique realpath as a
    // separate module — costing ~9 kB raw / ~3.6 kB gz in the lazy
    // CommandPalette chunk for functionally-identical code. dedupe forces a
    // single canonical copy at bundle time.
    dedupe: [
      "@radix-ui/react-primitive",
      "@radix-ui/react-slot",
    ],
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5174,
    },
  },
  build: {
    target: "esnext",
    sourcemap: true,
    // Three.js is intentionally large and loads lazily via React.lazy.
    // We don't ship over the network, so the default 500kB warning is noise.
    chunkSizeWarningLimit: 1000,
  },
});
