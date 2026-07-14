import { defineConfig } from 'vite';

// Single-file ESM bundle registered once in Home Assistant as a dashboard
// resource (/hacsfiles/evcc-hmac-widget/evcc-cards.js). All custom elements
// are registered from the one entry point.
export default defineConfig({
  build: {
    lib: {
      entry: 'src/evcc-cards.ts',
      formats: ['es'],
      fileName: () => 'evcc-cards.js',
    },
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2021',
    // HA serves the bundle as-is; keep everything inlined, no code-splitting.
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    minify: 'esbuild',
  },
});
