import packageInfo from './package.json' with { type: 'json' };
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { crx, defineManifest } from '@crxjs/vite-plugin';
import { fileURLToPath } from 'node:url';

const firefox = process.env.BROWSER === 'firefox';
const icons = { 16: 'icon-16.png', 32: 'icon-32.png', 48: 'icon-48.png', 128: 'icon-128.png' };
const matches = ['https://www.youtube.com/*'];
const background = 'src/background/index.ts';

const manifest = defineManifest({
  manifest_version: 3,
  name: 'YouTube Triage',
  version: packageInfo.version,
  description: packageInfo.description,
  icons,
  action: { default_title: 'Triage Watch Later', default_icon: icons },
  // Firefox MV3 has no service workers; it runs the same module as an event page.
  background: firefox
    ? { scripts: [background], type: 'module' }
    : { service_worker: background, type: 'module' },
  content_scripts: [
    // Page world: reuses the signed-in YouTube session to read and edit Watch Later.
    { matches, js: ['src/page/innertube.iife.ts'], world: 'MAIN' },
    { matches, js: ['src/content/index.tsx'] },
  ],
  ...(firefox && {
    browser_specific_settings: {
      gecko: {
        id: 'youtube-triage@arhunsaday',
        strict_min_version: '142.0',
        data_collection_permissions: { required: ['none'] },
      },
    },
  }),
});

export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest, browser: firefox ? 'firefox' : 'chrome' })],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { outDir: firefox ? 'dist-firefox' : 'dist' },
  server: { port: 5174, strictPort: true },
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts'] },
});
