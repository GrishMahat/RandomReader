import type { ExtensionMessage } from '../models';
import { STORAGE_KEYS } from '../models';
import { normalizeDomain } from '../utils';
import {
  getCatalog,
  getLocalCatalog,
  getSettings,
  getStoredCatalog,
  importCatalogFromJson,
  patchSettings,
  refreshCatalog,
  setActiveCatalog,
  setSettings,
  updateCatalogIfNewer,
} from './catalog';
import {
  BATCH_SIZE_ALARM,
  BATCH_SIZE_STARTUP,
  clearOldArticles,
  getArticles,
  refreshRandomBatch,
  toggleStarred,
} from './feeds';
import { handleGetRandom, handleOpenRandom } from './random';
import { getReadHistory } from './storage';

const ALARM_REFRESH = 'refresh-feeds';
const ALARM_CLEANUP = 'cleanup-old-articles';
const ALARM_CATALOG = 'update-catalog';
/** Manifest command name for the "Surprise Me" keyboard shortcut. */
const COMMAND_ROLL = 'roll-random';

/** How often (in ms) to poll for a newer remote catalog. */
const CATALOG_UPDATE_INTERVAL_MINUTES = 6 * 60;
/** How far in the future (ms) to schedule the one-time cleanup alarm. */
const CLEANUP_ALARM_DELAY_MS = 24 * 60 * 60 * 1000;

chrome.runtime.onInstalled.addListener(async (details) => {
  await refreshCatalog();
  await refreshRandomBatch(BATCH_SIZE_STARTUP);
  await scheduleAlarmsFromSettings();

  if (details.reason === 'install') {
    const settings = await getSettings();
    if (!settings.onboarded) {
      chrome.runtime.openOptionsPage();
    }
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await refreshCatalog();
  const settings = await getSettings();
  if (settings.refreshOnStartup) {
    await refreshRandomBatch(BATCH_SIZE_STARTUP);
  }
  await scheduleAlarmsFromSettings();
});

/**
 * Reschedule the refresh alarm using the current autoRefreshInterval setting.
 * The catalog and cleanup alarms are only re-created when not already pending,
 * so changing unrelated settings (theme, sound, etc.) does not reset them.
 */
async function scheduleAlarmsFromSettings(): Promise<void> {
  const settings = await getSettings();

  // Always recreate the refresh alarm since its period depends on a user setting.
  await chrome.alarms.clear(ALARM_REFRESH);
  chrome.alarms.create(ALARM_REFRESH, { when: Date.now() + settings.autoRefreshInterval });

  // Catalog and cleanup alarms are periodic; only create if they don't exist yet.
  const existingCatalog = await chrome.alarms.get(ALARM_CATALOG);
  if (!existingCatalog) {
    chrome.alarms.create(ALARM_CATALOG, {
      delayInMinutes: CATALOG_UPDATE_INTERVAL_MINUTES,
      periodInMinutes: CATALOG_UPDATE_INTERVAL_MINUTES,
    });
  }

  const existingCleanup = await chrome.alarms.get(ALARM_CLEANUP);
  if (!existingCleanup) {
    chrome.alarms.create(ALARM_CLEANUP, { when: Date.now() + CLEANUP_ALARM_DELAY_MS });
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  switch (alarm.name) {
    case ALARM_REFRESH:
      await refreshCatalog();
      await refreshRandomBatch(BATCH_SIZE_ALARM);
      await scheduleAlarmsFromSettings();
      break;
    case ALARM_CATALOG:
      await updateCatalogIfNewer();
      break;
    case ALARM_CLEANUP:
      await clearOldArticles();
      await scheduleAlarmsFromSettings();
      break;
  }
});

interface MessageSender {
  id?: string;
  url?: string;
  origin?: string;
  tab?: { id: number; url: string };
  frameId?: number;
}

// ─── Message handler registry ────────────────────────────────────────────────

/** Settings keys that affect alarm scheduling when patched. */
const ALARM_RELEVANT_KEYS = ['autoRefreshInterval'] as const;

type MessageHandler = (msg: ExtensionMessage) => Promise<unknown>;

const messageHandlers: Record<ExtensionMessage['type'], MessageHandler> = {
  GET_RANDOM: async () => {
    const settings = await getSettings();
    return handleGetRandom(settings);
  },
  OPEN_RANDOM: async () => {
    const settings = await getSettings();
    return handleOpenRandom(settings);
  },
  REFRESH_FEEDS: async () => {
    const result = await refreshRandomBatch(BATCH_SIZE_ALARM);
    return { success: !result.error, fetched: result.fetched, added: result.added, error: result.error };
  },
  REFRESH_CATALOG: async () => {
    const catalog = await refreshCatalog();
    return { success: true, catalog };
  },
  IMPORT_CATALOG: async (msg) => {
    const m = msg as Extract<ExtensionMessage, { type: 'IMPORT_CATALOG' }>;
    const result = await importCatalogFromJson(m.raw ?? '');
    return { success: result.ok, ...(result.ok ? { catalog: result.catalog } : { error: result.error }) };
  },
  GET_CATALOG_INFO: async () => {
    const settings = await getSettings();
    const local = await getLocalCatalog();
    const remote = await getStoredCatalog();
    const active = await getCatalog();
    return {
      success: true,
      mode: settings.catalogMode,
      catalogUrl: settings.catalogUrl,
      local,
      remote,
      blockedDomains: active?.blockedDomains ?? [],
    };
  },
  UPDATE_BLOCKED_DOMAINS: async (msg) => {
    const m = msg as Extract<ExtensionMessage, { type: 'UPDATE_BLOCKED_DOMAINS' }>;
    const catalog = await getCatalog();
    if (!catalog) return { success: false, error: 'No catalog loaded' };
    const normalized: string[] = [...new Set((m.domains ?? []).map(normalizeDomain).filter(Boolean))];
    await setActiveCatalog({ ...catalog, blockedDomains: normalized });
    return { success: true, blockedDomains: normalized };
  },
  GET_SETTINGS: async () => {
    const settings = await getSettings();
    return { success: true, settings };
  },
  SET_SETTINGS: async (msg) => {
    const m = msg as Extract<ExtensionMessage, { type: 'SET_SETTINGS' }>;
    const settings = await setSettings(m.settings ?? {});
    await scheduleAlarmsFromSettings();
    return { success: true, settings };
  },
  PATCH_SETTINGS: async (msg) => {
    const m = msg as Extract<ExtensionMessage, { type: 'PATCH_SETTINGS' }>;
    const { settings, changed } = await patchSettings(m.settings ?? {});
    if (changed && ALARM_RELEVANT_KEYS.some((key) => key in (m.settings ?? {}))) {
      await scheduleAlarmsFromSettings();
    }
    return { success: true, settings };
  },
  GET_SOURCES: async () => {
    const catalog = await getCatalog();
    return { success: true, sources: catalog?.sources ?? [] };
  },
  TOGGLE_SOURCE: async (msg) => {
    const m = msg as Extract<ExtensionMessage, { type: 'TOGGLE_SOURCE' }>;
    const catalog = await getCatalog();
    if (!catalog) return { success: false, error: 'No catalog' };
    const source = catalog.sources.find((s) => s.id === m.sourceId);
    if (!source) return { success: false, error: 'Source not found' };
    source.enabled = !source.enabled;
    // Re-enabling a snoozed source wakes it up.
    if (source.enabled) delete source.snoozedUntil;
    await setActiveCatalog(catalog);
    return { success: true, sources: catalog.sources };
  },
  SNOOZE_SOURCE: async (msg) => {
    const m = msg as Extract<ExtensionMessage, { type: 'SNOOZE_SOURCE' }>;
    const catalog = await getCatalog();
    if (!catalog) return { success: false, error: 'No catalog' };
    const source = catalog.sources.find((s) => s.id === m.sourceId);
    if (!source) return { success: false, error: 'Source not found' };
    if (m.until != null && m.until > 0) source.snoozedUntil = m.until;
    else delete source.snoozedUntil;
    await setActiveCatalog(catalog);
    return { success: true, sources: catalog.sources };
  },
  TOGGLE_STAR: async (msg) => {
    const m = msg as Extract<ExtensionMessage, { type: 'TOGGLE_STAR' }>;
    if (!m.article) return { success: false, error: 'No article' };
    const starred = await toggleStarred(m.article, m.starred);
    return { success: true, starred };
  },
  GET_ARTICLES: async () => {
    const articles = await getArticles();
    return { success: true, articles };
  },
  GET_HISTORY: async () => {
    const history = await getReadHistory();
    const mapped = history.map((h) => ({
      id: h.id,
      title: h.title,
      url: h.url,
      fetchedAt: h.openedAt,
      sourceId: h.sourceId,
      sourceName: h.sourceName,
      author: h.author,
      read: true,
    }));
    return { success: true, history: mapped };
  },
  CLEAR_HISTORY: async () => {
    await chrome.storage.local.remove(STORAGE_KEYS.READ_HISTORY);
    return { success: true };
  },
  CLEAR_DATA: async () => {
    // Clear all user-generated data for a complete reset.
    // Title cache, roll stats, and roll history are also cleared so
    // diversity weighting and streaks start fresh.
    await chrome.storage.local.remove([
      STORAGE_KEYS.READ_HISTORY,
      STORAGE_KEYS.STARRED,
      STORAGE_KEYS.ARTICLES,
      STORAGE_KEYS.TITLE_CACHE,
      STORAGE_KEYS.ROLL_STATS,
      STORAGE_KEYS.ROLL_HISTORY,
    ]);
    return { success: true };
  },
};

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender: MessageSender, sendResponse: (response: unknown) => void) => {
    const msg = message as ExtensionMessage;
    (async () => {
      try {
        const handler = messageHandlers[msg.type];
        const response = handler ? await handler(msg) : { success: false, error: 'Unknown message type' };
        sendResponse(response);
      } catch (error) {
        sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    })();
    return true;
  },
);

/** Keyboard shortcut: roll without opening the popup (see manifest `commands`). */
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== COMMAND_ROLL) return;
  const settings = await getSettings();
  await handleOpenRandom(settings);
});
