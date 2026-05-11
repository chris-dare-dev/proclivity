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
