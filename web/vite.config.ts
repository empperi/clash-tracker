import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { manifestConfig } from './src/pwa-manifest';

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      // The service worker is intentionally disabled in dev. A dev SW adds nothing while
      // building features, but its caching/registration (and classic-vs-module worker
      // conflicts on re-registration) repeatedly broke local testing — e.g. stale shells
      // and `importScripts` workbox load failures that block the login flow. PWA/offline
      // behaviour is validated against a production build (`npm run build && npm run
      // preview`), where the real generateSW output runs. Flip `enabled` to true only when
      // you specifically need to exercise the SW in dev.
      devOptions: {
        enabled: false,
      },
      manifest: manifestConfig,
    }),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5011/demo-clash-tracker/europe-west1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
