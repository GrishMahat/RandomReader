import { html, LitElement, type PropertyValues } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { INTEREST_GROUPS, type InterestGroup } from '../config/interests';
import type { Catalog, Settings, Source } from '../models';
import { DEFAULT_SETTINGS } from '../models';
import { sendMessage } from '../utils/messaging';
import { applyTheme, resolveTheme, subscribeToSystemTheme } from '../utils/theme';
import { optionsStyles } from './options.styles';

import './components/general-section';
import './components/sources-section';
import './components/filters-section';
import './components/history-section';
import './components/catalog-section';
import './components/onboarding-screen';

import type { LocalCatalogInfo } from './components/catalog-section';
import type { ReadingStats } from './components/general-section';
import type { HistoryItem } from './components/history-section';

interface SettingsResponse {
  success: boolean;
  settings?: Settings;
  error?: string;
}

interface GenericResponse {
  success: boolean;
  fetched?: number;
  added?: number;
  count?: number;
  error?: string;
}

interface CatalogInfoResponse {
  success: boolean;
  mode?: Settings['catalogMode'];
  catalogUrl?: string;
  local?: Catalog | null;
  remote?: Catalog | null;
  blockedDomains?: string[];
  error?: string;
}

interface ImportResponse {
  success: boolean;
  error?: string;
  catalog?: { sources: Array<{ name: string; type: string; tags?: string[] }> };
}

type Section = 'general' | 'sources' | 'filters' | 'history' | 'catalog';

@customElement('random-reader-options')
export class RandomReaderOptions extends LitElement {
  static styles = optionsStyles;

  @state() private settings: Settings = { ...DEFAULT_SETTINGS };
  @state() private sources: Source[] = [];
  @state() private history: HistoryItem[] = [];
  @state() private statusMessage = '';
  @state() private statusType: 'success' | 'error' | 'info' = 'success';
  @state() private saving = false;
  @state() private activeSection: Section = 'general';
  @state() private localCatalog: LocalCatalogInfo | null = null;
  @state() private blockedDomains: string[] = [];
  @state() private toastVisible = false;
  private toastTimer: number | null = null;
  private unsubscribeTheme: (() => void) | null = null;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    this.updateAvailableTags();
    const results = await Promise.allSettled([
      this.loadSettings(),
      this.loadSources(),
      this.loadHistory(),
      this.loadCatalogInfo(),
    ]);
    if (results.some((r) => r.status === 'rejected')) {
      this.showStatus('Some data could not be loaded. Try reloading the page.', 'error');
    }
    applyTheme(this, this.settings.theme);
    this.unsubscribeTheme = subscribeToSystemTheme(this, () => this.settings.theme);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubscribeTheme?.();
    this.unsubscribeTheme = null;
  }

  private async loadSettings(): Promise<void> {
    const result = await sendMessage<SettingsResponse>({ type: 'GET_SETTINGS' });
    if (!result.success || !result.settings) {
      throw new Error(result.error || 'Failed to load settings');
    }
    this.settings = result.settings;
    applyTheme(this, this.settings.theme);
  }

  private async loadSources(): Promise<void> {
    const result = await sendMessage<{ success: boolean; sources?: Source[]; error?: string }>({ type: 'GET_SOURCES' });
    if (!result.success || !result.sources) {
      throw new Error(result.error || 'Failed to load sources');
    }
    this.sources = result.sources;
  }

  private async loadCatalogInfo(): Promise<void> {
    const result = await sendMessage<CatalogInfoResponse>({ type: 'GET_CATALOG_INFO' });
    if (!result.success) {
      throw new Error(result.error || 'Failed to load catalog info');
    }
    if (result.mode) {
      this.settings = { ...this.settings, catalogMode: result.mode };
    }
    this.localCatalog = result.local
      ? { version: result.local.version, updatedAt: result.local.updatedAt, sources: result.local.sources.length }
      : null;
    this.blockedDomains = result.blockedDomains ?? [];
  }

  private async loadHistory(): Promise<void> {
    const result = await sendMessage<{ success: boolean; history?: HistoryItem[]; error?: string }>({
      type: 'GET_HISTORY',
    });
    if (!result.success || !result.history) {
      throw new Error(result.error || 'Failed to load history');
    }
    this.history = result.history;
  }

  private async saveSettings(): Promise<void> {
    this.saving = true;
    this.clearStatus();
    try {
      const result = await sendMessage<{ success: boolean; error?: string }>({
        type: 'SET_SETTINGS',
        settings: this.settings,
      });
      if (result.success) {
        this.showStatus('Settings saved', 'success');
      } else {
        this.showStatus(result.error || 'Failed to save settings', 'error');
      }
    } catch {
      this.showStatus('Failed to save settings', 'error');
    } finally {
      this.saving = false;
    }
  }

  private handleSettingChange(e: CustomEvent<{ key: keyof Settings; value: unknown }>): void {
    const { key, value } = e.detail;
    this.settings = { ...this.settings, [key]: value };
    if (key === 'theme') {
      applyTheme(this, value as Settings['theme']);
    }
  }

  private async handleToggleSource(e: CustomEvent<{ sourceId: string }>): Promise<void> {
    const result = await sendMessage<{ success: boolean; sources?: Source[]; error?: string }>({
      type: 'TOGGLE_SOURCE',
      sourceId: e.detail.sourceId,
    });
    if (result.success && result.sources) {
      this.sources = result.sources;
    } else {
      this.showStatus(result.error || 'Failed to toggle source', 'error');
    }
  }

  private async handleSnoozeSource(e: CustomEvent<{ sourceId: string; days: number }>): Promise<void> {
    const until = e.detail.days > 0 ? Date.now() + e.detail.days * 24 * 60 * 60 * 1000 : null;
    const result = await sendMessage<{ success: boolean; sources?: Source[]; error?: string }>({
      type: 'SNOOZE_SOURCE',
      sourceId: e.detail.sourceId,
      until,
    });
    if (result.success && result.sources) {
      this.sources = result.sources;
      if (until) {
        const source = this.sources.find((s) => s.id === e.detail.sourceId);
        this.showStatus(
          `Snoozed ${source?.name ?? 'source'} until ${new Date(until).toLocaleDateString()}.`,
          'success',
        );
      }
    } else {
      this.showStatus(result.error || 'Failed to snooze source', 'error');
    }
  }

  private async handleImportFile(e: CustomEvent<{ file: File }>): Promise<void> {
    try {
      const text = await e.detail.file.text();
      const result = await sendMessage<ImportResponse>({ type: 'IMPORT_CATALOG', raw: text });
      if (result.success) {
        this.showStatus(
          `Catalog "${e.detail.file.name}" imported (${result.catalog?.sources.length ?? 0} sources)`,
          'success',
        );
        try {
          await this.loadSettings();
          await this.loadCatalogInfo();
          await this.loadSources();
        } catch {
          this.showStatus('Catalog imported, but the page could not reload it. Refresh manually.', 'error');
        }
      } else {
        this.showStatus(result.error || 'Import failed', 'error');
      }
    } catch {
      this.showStatus('Could not read file', 'error');
    }
  }

  private async handleCatalogModeChange(e: CustomEvent<{ useLocal: boolean }>): Promise<void> {
    this.settings = { ...this.settings, catalogMode: e.detail.useLocal ? 'local' : 'remote' };
    await this.saveSettings();
    const results = await Promise.allSettled([this.loadCatalogInfo(), this.loadSources()]);
    if (results.some((r) => r.status === 'rejected')) {
      this.showStatus('Mode saved, but the source list failed to reload. Try reloading the page.', 'error');
    }
  }

  private async handleAddBlockedDomain(e: CustomEvent<{ domain: string }>): Promise<void> {
    const domain = e.detail.domain.trim().toLowerCase();
    if (!domain || this.blockedDomains.includes(domain)) return;
    const next = [...this.blockedDomains, domain];
    const result = await sendMessage<{ success: boolean; blockedDomains?: string[]; error?: string }>({
      type: 'UPDATE_BLOCKED_DOMAINS',
      domains: next,
    });
    if (result.success) {
      this.blockedDomains = result.blockedDomains ?? next;
      this.showStatus(`Blocked ${domain}. New articles from it will be skipped.`, 'success');
    } else {
      this.showStatus(result.error || 'Failed to update blocked domains', 'error');
    }
  }

  private async handleRemoveBlockedDomain(e: CustomEvent<{ domain: string }>): Promise<void> {
    const next = this.blockedDomains.filter((d) => d !== e.detail.domain);
    const result = await sendMessage<{ success: boolean; blockedDomains?: string[]; error?: string }>({
      type: 'UPDATE_BLOCKED_DOMAINS',
      domains: next,
    });
    if (result.success) {
      this.blockedDomains = result.blockedDomains ?? next;
      this.showStatus(`Unblocked ${e.detail.domain}`, 'success');
    } else {
      this.showStatus(result.error || 'Failed to update blocked domains', 'error');
    }
  }

  private async handleRestoreDefaults(): Promise<void> {
    if (
      !window.confirm('Reset all settings to their defaults? Your catalog, history, and starred articles will be kept.')
    )
      return;
    this.settings = { ...DEFAULT_SETTINGS };
    await this.saveSettings();
    applyTheme(this, this.settings.theme);
    const results = await Promise.allSettled([this.loadCatalogInfo(), this.loadSources()]);
    if (results.some((r) => r.status === 'rejected')) {
      this.showStatus('Defaults restored, but the source list failed to reload.', 'error');
    }
  }

  private async handleClearData(): Promise<void> {
    if (!window.confirm('Clear reading history and all stored articles? Source toggles and settings are kept.')) return;
    const result = await sendMessage<GenericResponse>({ type: 'CLEAR_DATA' });
    if (result.success) {
      this.showStatus('Cleared articles and history', 'success');
      await this.loadHistory();
    } else {
      this.showStatus(result.error || 'Failed to clear data', 'error');
    }
  }

  private async handleClearHistory(): Promise<void> {
    if (!window.confirm('Clear your reading history?')) return;
    const result = await sendMessage<GenericResponse>({ type: 'CLEAR_HISTORY' });
    if (result.success) {
      this.showStatus('History cleared', 'success');
      await this.loadHistory();
    } else {
      this.showStatus(result.error || 'Failed to clear history', 'error');
    }
  }

  private async handleRefreshCatalog(): Promise<void> {
    this.showStatus('Syncing catalog...', 'info');
    try {
      const result = await sendMessage<GenericResponse>({ type: 'REFRESH_CATALOG' });
      if (result.success) {
        this.showStatus('Catalog synced', 'success');
        try {
          await this.loadSources();
        } catch {
          this.showStatus('Catalog synced, but the source list failed to reload.', 'error');
        }
      } else {
        this.showStatus(result.error || 'Failed to sync catalog', 'error');
      }
    } catch {
      this.showStatus('Failed to sync catalog', 'error');
    }
  }

  private async handleRefreshFeedsNow(): Promise<void> {
    this.showStatus('Refreshing feeds...', 'info');
    try {
      const result = await sendMessage<GenericResponse>({ type: 'REFRESH_FEEDS' });
      if (result.success) {
        this.showStatus(`Refreshed: ${result.fetched || 0} sources (${result.added || 0} new articles)`, 'success');
      } else {
        this.showStatus(result.error || 'Refresh failed', 'error');
      }
    } catch {
      this.showStatus('Refresh failed', 'error');
    }
  }

  private exportHistory(e: CustomEvent<{ format: 'csv' | 'json' }>): void {
    if (this.history.length === 0) return;
    const format = e.detail.format;
    const rows = this.history.map((h) => ({
      title: h.title,
      url: h.url,
      source: h.sourceName || h.sourceId,
      author: h.author || '',
      visitedAt: new Date(h.fetchedAt).toISOString(),
    }));

    let content: string;
    let mime: string;
    let ext: string;
    if (format === 'csv') {
      const esc = (v: string): string => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const header = ['title', 'url', 'source', 'author', 'visitedAt'];
      content = [
        header.join(','),
        ...rows.map((r) => [r.title, r.url, r.source, r.author, r.visitedAt].map(esc).join(',')),
      ].join('\n');
      mime = 'text/csv';
      ext = 'csv';
    } else {
      content = JSON.stringify(rows, null, 2);
      mime = 'application/json';
      ext = 'json';
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `random-reader-history.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private get readingStats(): ReadingStats {
    const total = this.history.length;
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const last7 = this.history.filter((h) => h.fetchedAt >= cutoff).length;
    const bySource = new Map<string, number>();
    for (const h of this.history) {
      const name = h.sourceName || h.sourceId;
      bySource.set(name, (bySource.get(name) ?? 0) + 1);
    }
    const topSources = [...bySource.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    return { total, last7, topSources };
  }

  /** Cached tag list; rebuilt only when `sources` changes (see willUpdate). */
  private cachedAvailableTags: string[] = [];

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has('sources')) {
      this.updateAvailableTags();
    }
  }

  private updateAvailableTags(): void {
    const tags = new Set<string>();
    for (const source of this.sources) {
      for (const tag of source.tags ?? []) {
        tags.add(tag);
      }
    }
    this.cachedAvailableTags = [...tags].sort();
  }

  private get availableTags(): string[] {
    return this.cachedAvailableTags;
  }

  private get onboardingGroups(): InterestGroup[] {
    const known = new Set(this.availableTags);
    return INTEREST_GROUPS.filter((g) => g.tags.some((t) => known.has(t)));
  }

  private async handleFinishOnboarding(e: CustomEvent<{ selectedInterests: string[] }>): Promise<void> {
    const known = new Set(this.availableTags);
    const includeTags = new Set<string>();
    for (const group of this.onboardingGroups) {
      if (e.detail.selectedInterests.includes(group.label)) {
        for (const tag of group.tags) {
          if (known.has(tag)) includeTags.add(tag);
        }
      }
    }
    this.settings = { ...this.settings, includeTags: [...includeTags], onboarded: true };
    await this.saveSettings();
    await this.loadSources();
  }

  private async handleSkipOnboarding(): Promise<void> {
    this.settings = { ...this.settings, onboarded: true };
    await this.saveSettings();
  }

  private showStatus(message: string, type: 'success' | 'error' | 'info'): void {
    this.statusMessage = message;
    this.statusType = type;
    this.toastVisible = true;
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
    }
    this.toastTimer = window.setTimeout(() => {
      this.toastVisible = false;
      this.statusMessage = '';
      this.toastTimer = null;
    }, 3500);
  }

  private clearStatus(): void {
    this.statusMessage = '';
    this.toastVisible = false;
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }

  private async selectSection(section: Section): Promise<void> {
    this.activeSection = section;
    this.clearStatus();
    if (section === 'history') {
      try {
        await this.loadHistory();
      } catch {
        this.showStatus('Failed to load history.', 'error');
      }
    }
  }

  render() {
    if (!this.settings.onboarded) return this.renderOnboarding();
    return html`
      <div class="page-shell">
        ${this.renderTopBar()}
        ${this.renderSidebar()}
        <main class="main-content">${this.renderActiveSection()}</main>
      </div>
      ${this.toastVisible && this.statusMessage ? this.renderToast() : ''}
    `;
  }

  private renderOnboarding(): ReturnType<typeof html> {
    return html`
      <onboarding-screen
        .groups=${this.onboardingGroups}
        .saving=${this.saving}
        data-theme=${resolveTheme(this.settings.theme)}
        @finish-onboarding=${this.handleFinishOnboarding}
        @skip-onboarding=${this.handleSkipOnboarding}
      ></onboarding-screen>
    `;
  }

  private renderTopBar(): ReturnType<typeof html> {
    return html`
      <header class="topbar">
        <div class="topbar-logo">
          <img src=${new URL('../icons/icon-32.png', import.meta.url).href} alt="" width="32" height="32" />
        </div>
        <span class="topbar-title">Random Reader</span>
        <span class="topbar-sub">Settings</span>
      </header>
    `;
  }

  private renderSidebar(): ReturnType<typeof html> {
    const navItems: { id: Section; label: string; icon: string; badge?: string }[] = [
      { id: 'general', label: 'General', icon: '⚙️' },
      { id: 'sources', label: 'Sources', icon: '📡', badge: String(this.sources.length) },
      { id: 'filters', label: 'Filters', icon: '⚗️' },
      {
        id: 'history',
        label: 'History',
        icon: '🕓',
        badge: this.history.length > 0 ? String(this.history.length) : '',
      },
      { id: 'catalog', label: 'Catalog', icon: '📦' },
    ];
    return html`
      <nav class="sidebar">
        <div class="sidebar-label">Settings</div>
        ${navItems.map(
          (item) => html`
            <button
              class="nav-item ${this.activeSection === item.id ? 'active' : ''}"
              @click=${() => this.selectSection(item.id)}
            >
              <span class="nav-icon">${item.icon}</span>
              <span class="nav-label">${item.label}</span>
              ${item.badge ? html`<span class="nav-badge">${item.badge}</span>` : ''}
            </button>
          `,
        )}
      </nav>
    `;
  }

  private renderActiveSection(): ReturnType<typeof html> {
    switch (this.activeSection) {
      case 'sources':
        return this.renderSourcesSection();
      case 'filters':
        return this.renderFiltersSection();
      case 'history':
        return this.renderHistorySection();
      case 'catalog':
        return this.renderCatalogSection();
      default:
        return this.renderGeneralSection();
    }
  }

  private renderGeneralSection(): ReturnType<typeof html> {
    return html`
      <general-section
        .settings=${this.settings}
        .stats=${this.readingStats}
        .saving=${this.saving}
        data-theme=${resolveTheme(this.settings.theme)}
        @setting-change=${this.handleSettingChange}
        @save-settings=${this.saveSettings}
        @restore-defaults=${this.handleRestoreDefaults}
        @clear-data=${this.handleClearData}
      ></general-section>
    `;
  }

  private renderSourcesSection(): ReturnType<typeof html> {
    return html`
      <sources-section
        .sources=${this.sources}
        .availableTags=${this.availableTags}
        data-theme=${resolveTheme(this.settings.theme)}
        @toggle-source=${this.handleToggleSource}
        @snooze-source=${this.handleSnoozeSource}
      ></sources-section>
    `;
  }

  private renderFiltersSection(): ReturnType<typeof html> {
    return html`
      <filters-section
        .settings=${this.settings}
        .availableTags=${this.availableTags}
        .saving=${this.saving}
        data-theme=${resolveTheme(this.settings.theme)}
        @setting-change=${this.handleSettingChange}
        @save-settings=${this.saveSettings}
      ></filters-section>
    `;
  }

  private renderHistorySection(): ReturnType<typeof html> {
    return html`
      <history-section
        .history=${this.history}
        data-theme=${resolveTheme(this.settings.theme)}
        @refresh-history=${this.loadHistory}
        @clear-history=${this.handleClearHistory}
        @export-history=${this.exportHistory}
      ></history-section>
    `;
  }

  private renderCatalogSection(): ReturnType<typeof html> {
    return html`
      <catalog-section
        .settings=${this.settings}
        .localCatalog=${this.localCatalog}
        .blockedDomains=${this.blockedDomains}
        data-theme=${resolveTheme(this.settings.theme)}
        @setting-change=${this.handleSettingChange}
        @catalog-mode-change=${this.handleCatalogModeChange}
        @import-catalog-file=${this.handleImportFile}
        @add-blocked-domain=${this.handleAddBlockedDomain}
        @remove-blocked-domain=${this.handleRemoveBlockedDomain}
        @refresh-catalog=${this.handleRefreshCatalog}
        @refresh-feeds-now=${this.handleRefreshFeedsNow}
      ></catalog-section>
    `;
  }

  private renderToast(): ReturnType<typeof html> {
    return html`<div class="toast ${this.statusType}" role="status">
      <span class="toast-message">${this.statusMessage}</span>
      <button class="toast-close" @click=${this.clearStatus} aria-label="Dismiss">×</button>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'random-reader-options': RandomReaderOptions;
  }
}
