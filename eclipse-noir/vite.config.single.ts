import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// One-off config used to produce a single self-contained bundle for hosting on
// a page that cannot fetch sibling asset files.
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    outDir: 'dist-single',
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    rollupOptions: {
      output: { inlineDynamicImports: true, entryFileNames: 'app.js', assetFileNames: 'app.[ext]' },
    },
  },
});
