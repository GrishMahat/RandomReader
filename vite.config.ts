import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config.ts';
import zip from 'vite-plugin-zip-pack';

const isFirefox = process.env.BROWSER === 'firefox';

const firefoxManifest = isFirefox
  ? {
      ...manifest,
      background: {
        scripts: [manifest.background.service_worker],
        type: 'module',
      },
      browser_specific_settings: {
        gecko: {
          id: 'random-reader@grishmahat.dev',
          strict_min_version: '121.0',
        },
      },
    }
  : manifest;

export default defineConfig({
  plugins: [
    crx({ manifest: firefoxManifest, browser: isFirefox ? 'firefox' : 'chrome' }),
    zip({ outDir: 'release', outFileName: `random-reader-${isFirefox ? 'firefox' : 'chrome'}.zip` }),
  ],
  server: {
    cors: {
      origin: [/chrome-extension:\/\//],
    },
  },
  build: {
    outDir: isFirefox ? 'dist/firefox' : 'dist/chrome',
    emptyOutDir: true,
  },
});
