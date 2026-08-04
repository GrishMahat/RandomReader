import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crx } from '@crxjs/vite-plugin';
import { defineConfig } from 'vite';
import zip from 'vite-plugin-zip-pack';
import manifest from './manifest.config.ts';

const isFirefox = process.env.BROWSER === 'firefox';
const __dirname = dirname(fileURLToPath(import.meta.url));

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
          strict_min_version: '140.0',
          data_collection_permissions: {
            required: ['none' as const],
          },
        },
      },
    }
  : manifest;

export default defineConfig({
  plugins: [
    crx({ manifest: firefoxManifest, browser: isFirefox ? 'firefox' : 'chrome' }),
    zip({
      outDir: 'release',
      outFileName: `random-reader-${isFirefox ? 'firefox' : 'chrome'}.zip`,
      inDir: resolve(__dirname, isFirefox ? 'dist/firefox' : 'dist/chrome'),
    }),
    isFirefox &&
      zip({
        outDir: 'release',
        outFileName: 'random-reader.xpi',
        inDir: resolve(__dirname, 'dist/firefox'),
      }),
  ].filter(Boolean),
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
