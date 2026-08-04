export default {
  manifest_version: 3,
  name: 'Random Reader',
  description: 'Read random articles from curated sources',
  version: '0.1.2',
  homepage_url: 'https://grishmahat.github.io/RandomReader/',
  permissions: ['storage', 'alarms', 'unlimitedStorage'],
  host_permissions: ['http://*/*', 'https://*/*'],
  // Explicit MV3 CSP: no inline scripts, no remote code, no wasm.
  // connect-src is deliberately unset so feed/catalog fetches stay unrestricted.
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self';",
  },
  background: {
    service_worker: 'src/background/main.ts',
    type: 'module',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'Random Reader',
    default_icon: {
      '16': 'src/icons/icon-16.png',
      '32': 'src/icons/icon-32.png',
      '48': 'src/icons/icon-48.png',
      '128': 'src/icons/icon-128.png',
    },
  },
  commands: {
    'roll-random': {
      suggested_key: { default: 'Alt+Shift+R', mac: 'Command+Shift+Y' },
      description: 'Open a random article',
    },
  },
  options_page: 'src/options/index.html',
  icons: {
    '16': 'src/icons/icon-16.png',
    '32': 'src/icons/icon-32.png',
    '48': 'src/icons/icon-48.png',
    '128': 'src/icons/icon-128.png',
  },
};
