import { refreshCatalog, updateCatalogIfNewer, getSettings, setSettings, getCatalog, setActiveCatalog, importCatalogFromJson, getStoredCatalog, getLocalCatalog } from './catalog';
import { refreshRandomBatch, clearOldArticles, getArticles, toggleStarred } from './feeds';
import { handleOpenRandom, handleGetRandom } from './random';
import { getReadHistory } from './storage';
import { normalizeDomain } from '../utils';
import type { Article, Settings } from '../models';

const ALARM_REFRESH = 'refresh-feeds';
const ALARM_CLEANUP = 'cleanup-old-articles';
const ALARM_CATALOG = 'update-catalog';

const CATALOG_UPDATE_INTERVAL_MINUTES = 6 * 60;

chrome.runtime.onInstalled.addListener(async (details) => {
  await refreshCatalog();
  await refreshRandomBatch(20);
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
    await refreshRandomBatch(20);
  }
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
      await refreshRandomBatch(10);
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
  article?: Article;
  starred?: boolean;
  domains?: string[];
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
          const result = await refreshRandomBatch(10);
          sendResponse({ success: true, fetched: result.fetched, added: result.added });
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
        case 'GET_CATALOG_INFO': {
          const settings = await getSettings();
          const local = await getLocalCatalog();
          const remote = await getStoredCatalog();
          const active = await getCatalog();
          sendResponse({ success: true, mode: settings.catalogMode, catalogUrl: settings.catalogUrl, local, remote, blockedDomains: active?.blockedDomains ?? [] });
          break;
        }
        case 'UPDATE_BLOCKED_DOMAINS': {
          const catalog = await getCatalog();
          if (!catalog) {
            sendResponse({ success: false, error: 'No catalog loaded' });
            break;
          }
          const normalized = [...new Set((msg.domains ?? []).map(normalizeDomain).filter(Boolean))];
          await setActiveCatalog({ ...catalog, blockedDomains: normalized });
          sendResponse({ success: true, blockedDomains: normalized });
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
              await setActiveCatalog(catalog);
              sendResponse({ success: true, sources: catalog.sources });
            } else {
              sendResponse({ success: false, error: 'Source not found' });
            }
          } else {
            sendResponse({ success: false, error: 'No catalog' });
          }
          break;
        }
        case 'TOGGLE_STAR': {
          if (msg.article) {
            const starred = await toggleStarred(msg.article, msg.starred);
            sendResponse({ success: true, starred });
          } else {
            sendResponse({ success: false, error: 'No article' });
          }
          break;
        }
        case 'GET_ARTICLES': {
          const articles = await getArticles();
          sendResponse({ success: true, articles });
          break;
        }
        case 'GET_HISTORY': {
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
          sendResponse({ success: true, history: mapped });
          break;
        }
        case 'CLEAR_HISTORY': {
          await chrome.storage.local.remove('readHistory');
          sendResponse({ success: true });
          break;
        }
        case 'CLEAR_DATA': {
          await chrome.storage.local.remove(['readHistory', 'starred', 'articles']);
          sendResponse({ success: true });
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