import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Build config for the single-file Artifact publish.
 *
 * The normal build splits three/r3f/postprocessing into cacheable chunks; an Artifact is
 * one HTML document with no sibling files to fetch, so this variant collapses everything
 * into a single entry chunk that `scripts/build-artifact.mjs` inlines.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2020",
    outDir: "dist-artifact",
    cssCodeSplit: false,
    // No sibling requests are possible, so inline every asset regardless of size.
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    rollupOptions: {
      output: {
        manualChunks: undefined,
        inlineDynamicImports: true,
      },
    },
  },
});
