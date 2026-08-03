// Type declarations for Chrome Extensions API

interface ChromeAlarms {
  create(name?: string, alarmInfo?: { when?: number; periodInMinutes?: number } | { delayInMinutes?: number; periodInMinutes?: number }): void;
  get(name?: string): Promise<{ name: string; scheduledTime: number; periodInMinutes?: number } | undefined>;
  getAll(): Promise<Array<{ name: string; scheduledTime: number; periodInMinutes?: number }>>;
  clear(name?: string): Promise<boolean>;
  clearAll(): Promise<boolean>;
  onAlarm: { addListener: (callback: (alarm: { name: string; scheduledTime: number; periodInMinutes?: number }) => void) => void; removeListener: (listener: (alarm: { name: string; scheduledTime: number; periodInMinutes?: number }) => void) => void; hasListener: (listener: (alarm: { name: string; scheduledTime: number; periodInMinutes?: number }) => void) => boolean };
}

interface ChromeRuntime {
  onInstalled: { addListener: (callback: (details: { reason: 'install' | 'update' | 'chrome_update' | 'shared_module_update'; previousVersion?: string }) => void) => void };
  onStartup: { addListener: (callback: () => void) => void };
  onMessage: { addListener: (callback: (message: unknown, sender: MessageSender, sendResponse: (response: unknown) => void) => boolean | void) => void };
  sendMessage(message: unknown, options?: { includeTlsChannelId?: boolean; toProxyScript?: boolean }): Promise<unknown>;
  sendMessage(message: unknown, callback: (response: unknown) => void): void;
  openOptionsPage(): void;
  getManifest(): Record<string, unknown>;
  getURL(path: string): string;
  id: string;
  lastError: { message: string } | undefined;
}

interface MessageSender {
  id?: string;
  url?: string;
  origin?: string;
  tab?: { id: number; url: string };
  frameId?: number;
}

interface ChromeStorage {
  local: {
    get(keys: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
    set(items: Record<string, unknown>): Promise<void>;
    remove(keys: string | string[]): Promise<void>;
    clear(): Promise<void>;
  };
  sync: {
    get(keys: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
    set(items: Record<string, unknown>): Promise<void>;
    remove(keys: string | string[]): Promise<void>;
    clear(): Promise<void>;
  };
}

interface ChromeTabs {
  create(createProperties: { url: string; active?: boolean }): Promise<{ id: number; url: string }>;
  query(queryInfo: { active?: boolean; currentWindow?: boolean }): Promise<Array<{ id: number; url: string }>>;
  update(tabId: number, updateProperties: { url: string }): Promise<{ id: number; url: string }>;
}

interface ChromeAction {
  setPopup(details: { popup: string }): void;
  setTitle(details: { title: string }): void;
  setIcon(details: { path: string | Record<number, string> }): void;
  onClicked: { addListener: (callback: (tab: { id: number; url: string }) => void) => void };
}

declare namespace chrome {
  export const alarms: ChromeAlarms;
  export const runtime: ChromeRuntime;
  export const storage: ChromeStorage;
  export const tabs: ChromeTabs;
  export const action: ChromeAction;
}