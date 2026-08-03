import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import chromeManifest from './src/manifest.json' with { type: 'json' };

const isFirefox = process.env.BROWSER === 'firefox';

const manifest = isFirefox
  ? {
      ...chromeManifest,
      browser_specific_settings: {
        gecko: {
          id: 'random-reader@grishmahat.dev',
          strict_min_version: '121.0',
        },
      },
    }
  : chromeManifest;

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: isFirefox ? 'dist/firefox' : 'dist/chrome',
    emptyOutDir: true,
  },
});
