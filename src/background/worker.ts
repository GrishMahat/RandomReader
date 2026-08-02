import { refreshCatalog, updateCatalogIfNewer, getSettings, setSettings, getCatalog, setCatalog, importCatalogFromJson } from './catalog';
import { refreshFeeds, clearOldArticles } from './feeds';
import { handleOpenRandom, handleGetRandom } from './random';
import type { Settings } from '../models';

const ALARM_REFRESH = 'refresh-feeds';
const ALARM_CLEANUP = 'cleanup-old-articles';
const ALARM_CATALOG = 'update-catalog';

const CATALOG_UPDATE_INTERVAL_MINUTES = 6 * 60;

chrome.runtime.onInstalled.addListener(async () => {
  await refreshCatalog();
  await refreshFeeds();
  await scheduleAlarmsFromSettings();
});

chrome.runtime.onStartup.addListener(async () => {
  await refreshCatalog();
  await refreshFeeds();
  await scheduleAlarmsFromSettings();
});

async function scheduleAlarmsFromSettings(): Promise<void> {
  const settings = await getSettings();
  chrome.alarms.clearAll();
  chrome.alarms.create(ALARM_REFRESH, { when: Date.now() + settings.autoRefreshInterval });
  chrome.alarms.create(ALARM_CATALOG, { delayInMinutes: CATALOG_UPDATE_INTERVAL_MINUTES, periodInMinutes: CATALOG_UPDATE_INTERVAL_MINUTES });
  chrome.alarms.create(ALARM_CLEANUP, { when: Date.now() + 24 * 60 * 60 * 1000 });
}

interface Alarm {
  name: string;
  scheduledTime: number;
  periodInMinutes?: number;
}

chrome.alarms.onAlarm.addListener(async (alarm: Alarm) => {
  switch (alarm.name) {
    case ALARM_REFRESH:
      await refreshCatalog();
      await refreshFeeds();
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

interface Message {
  type: string;
  settings?: Partial<Settings>;
  sourceId?: string;
  raw?: string;
}

interface MessageSender {
  id?: string;
  url?: string;
  origin?: string;
  tab?: { id: number; url: string };
  frameId?: number;
}

chrome.runtime.onMessage.addListener((message: unknown, _sender: MessageSender, sendResponse: (response: unknown) => void) => {
  const msg = message as Message;
  (async () => {
    try {
      switch (msg.type) {
        case 'GET_RANDOM': {
          const settings = await getSettings();
          const result = await handleGetRandom(settings);
          sendResponse(result);
          break;
        }
        case 'OPEN_RANDOM': {
          const settings = await getSettings();
          const result = await handleOpenRandom(settings);
          sendResponse(result);
          break;
        }
        case 'REFRESH_FEEDS': {
          const count = await refreshFeeds();
          sendResponse({ success: true, count });
          break;
        }
        case 'REFRESH_CATALOG': {
          const catalog = await refreshCatalog();
          sendResponse({ success: true, catalog });
          break;
        }
        case 'IMPORT_CATALOG': {
          const result = await importCatalogFromJson(msg.raw ?? '');
          sendResponse({ success: result.ok, ...(result.ok ? { catalog: result.catalog } : { error: result.error }) });
          break;
        }
        case 'GET_SETTINGS': {
          const settings = await getSettings();
          sendResponse({ success: true, settings });
          break;
        }
        case 'SET_SETTINGS': {
          const settings = await setSettings(msg.settings ?? {});
          await scheduleAlarmsFromSettings();
          sendResponse({ success: true, settings });
          break;
        }
        case 'GET_SOURCES': {
          const catalog = await getCatalog();
          sendResponse({ success: true, sources: catalog?.sources ?? [] });
          break;
        }
        case 'TOGGLE_SOURCE': {
          const catalog = await getCatalog();
          if (catalog && msg.sourceId) {
            const source = catalog.sources.find((s) => s.id === msg.sourceId);
            if (source) {
              source.enabled = !source.enabled;
              await setCatalog(catalog);
              sendResponse({ success: true, sources: catalog.sources });
            } else {
              sendResponse({ success: false, error: 'Source not found' });
            }
          } else {
            sendResponse({ success: false, error: 'No catalog' });
          }
          break;
        }
        case 'GET_ARTICLES': {
          const { getArticles } = await import('./feeds');
          const articles = await getArticles();
          sendResponse({ success: true, articles });
          break;
        }
        case 'GET_HISTORY': {
          const { getArticles } = await import('./feeds');
          const articles = await getArticles();
          const history = articles.filter(a => a.read).sort((a, b) => (b.fetchedAt || 0) - (a.fetchedAt || 0));
          sendResponse({ success: true, history });
          break;
        }
        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  })();
  return true;
});