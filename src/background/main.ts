import type { ExtensionMessage, MessageResponses } from '../models';
import { STORAGE_KEYS } from '../models';
import { DAY_MS, normalizeDomain } from '../utils';
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
} from './catalog';
import {
  BATCH_SIZE_ALARM,
  BATCH_SIZE_STARTUP,
  clearOldArticles,
  getArticles,
  getReadHistory,
  refreshRandomBatch,
  toggleStarred,
} from './feeds';
import { handleGetRandom, handleOpenRandom } from './random';
import { clearUserData, removeStore } from './store';

const ALARM_REFRESH = 'refresh-feeds';
const ALARM_CLEANUP = 'cleanup-old-articles';
const ALARM_CATALOG = 'update-catalog';
/** Manifest command name for the "Surprise Me" keyboard shortcut. */
const COMMAND_ROLL = 'roll-random';

/** How often (in ms) to poll for a newer remote catalog. */
const CATALOG_UPDATE_INTERVAL_MINUTES = 6 * 60;
/** How far in the future (ms) to schedule the one-time cleanup alarm. */
const CLEANUP_ALARM_DELAY_MS = DAY_MS;

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
    // Same single update path as startup, so no version gate can diverge from it.
    case ALARM_CATALOG:
      await refreshCatalog();
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

/**
 * Keyed by MessageResponses so each handler's `msg` parameter narrows to its
 * own request shape and its return type is checked against the response map.
 * No per-handler Extract casts, no ad-hoc response shapes.
 */
const messageHandlers: {
  [K in keyof MessageResponses]: (
    msg: Extract<ExtensionMessage, { type: K }>,
  ) => Promise<MessageResponses[K]> | MessageResponses[K];
} = {
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
    const { catalog, fetched } = await refreshCatalog();
    return fetched ? { success: true, catalog } : { success: false, error: 'Could not reach the catalog URL', catalog };
  },
  IMPORT_CATALOG: async (msg) => {
    const result = await importCatalogFromJson(msg.raw ?? '');
    return result.ok ? { success: true, catalog: result.catalog } : { success: false, error: result.error };
  },
  GET_CATALOG_INFO: async () => {
    const settings = await getSettings();
    const local = await getLocalCatalog();
    const remote = await getStoredCatalog();
    const active = await getCatalog();
    // Ship compact summaries over the pipe, not entire catalogs.
    const summarize = (c: typeof local) =>
      c ? { version: c.version, updatedAt: c.updatedAt, sourceCount: c.sources.length } : null;
    return {
      success: true,
      mode: settings.catalogMode,
      catalogUrl: settings.catalogUrl,
      local: summarize(local),
      remote: summarize(remote),
      blockedDomains: active?.blockedDomains ?? [],
    };
  },
  UPDATE_BLOCKED_DOMAINS: async (msg) => {
    const catalog = await getCatalog();
    if (!catalog) return { success: false, error: 'No catalog loaded' };
    const normalized: string[] = [...new Set((msg.domains ?? []).map(normalizeDomain).filter(Boolean))];
    await setActiveCatalog({ ...catalog, blockedDomains: normalized });
    return { success: true, blockedDomains: normalized };
  },
  GET_SETTINGS: async () => {
    return { success: true, settings: await getSettings() };
  },
  SET_SETTINGS: async (msg) => {
    const settings = await setSettings(msg.settings ?? {});
    await scheduleAlarmsFromSettings();
    return { success: true, settings };
  },
  PATCH_SETTINGS: async (msg) => {
    const { settings, changed } = await patchSettings(msg.settings ?? {});
    if (changed && ALARM_RELEVANT_KEYS.some((key) => key in (msg.settings ?? {}))) {
      await scheduleAlarmsFromSettings();
    }
    return { success: true, settings };
  },
  GET_SOURCES: async () => {
    const catalog = await getCatalog();
    return { success: true, sources: catalog?.sources ?? [] };
  },
  TOGGLE_SOURCE: async (msg) => {
    const catalog = await getCatalog();
    if (!catalog) return { success: false, error: 'No catalog' };
    const source = catalog.sources.find((s) => s.id === msg.sourceId);
    if (!source) return { success: false, error: 'Source not found' };
    source.enabled = !source.enabled;
    // Re-enabling a snoozed source wakes it up.
    if (source.enabled) delete source.snoozedUntil;
    await setActiveCatalog(catalog);
    return { success: true, sources: catalog.sources };
  },
  SNOOZE_SOURCE: async (msg) => {
    const catalog = await getCatalog();
    if (!catalog) return { success: false, error: 'No catalog' };
    const source = catalog.sources.find((s) => s.id === msg.sourceId);
    if (!source) return { success: false, error: 'Source not found' };
    if (msg.until != null && msg.until > 0) source.snoozedUntil = msg.until;
    else delete source.snoozedUntil;
    await setActiveCatalog(catalog);
    return { success: true, sources: catalog.sources };
  },
  TOGGLE_STAR: async (msg) => {
    if (!msg.article) return { success: false, error: 'No article' };
    const starred = await toggleStarred(msg.article, msg.starred);
    return { success: true, starred };
  },
  GET_ARTICLES: async () => {
    return { success: true, articles: await getArticles() };
  },
  GET_HISTORY: async () => {
    const history = await getReadHistory();
    return { success: true, history: history.map((h) => ({ ...h, read: true })) };
  },
  CLEAR_HISTORY: async () => {
    await removeStore(STORAGE_KEYS.READ_HISTORY);
    return { success: true };
  },
  CLEAR_DATA: async () => {
    // Clear all user-generated data for a complete reset; keys derived from
    // STORAGE_KEYS in one place (store.clearUserData), never hand-listed.
    await clearUserData();
    return { success: true };
  },
};

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender: MessageSender, sendResponse: (response: unknown) => void) => {
    const msg = message as ExtensionMessage;
    (async () => {
      try {
        // The registry is keyed by MessageResponses, so handler and request
        // always correspond; TS just can't correlate the union lookup here.
        const handler = messageHandlers[msg.type] as ((m: ExtensionMessage) => unknown) | undefined;
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
