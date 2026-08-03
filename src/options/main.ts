import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Settings, Source, Catalog } from '../models';
import { DEFAULT_SETTINGS } from '../models';
import { optionsStyles } from './options.styles';
import { applyTheme, subscribeToSystemTheme } from '../utils/theme';

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
  catalog?: unknown;
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

interface HistoryItem {
  id: string;
  title: string;
  url: string;
  fetchedAt: number;
  sourceId: string;
  sourceName?: string;
  author?: string;
  read: boolean;
}

type Section = 'general' | 'sources' | 'filters' | 'history' | 'catalog';

interface InterestGroup {
  label: string;
  icon: string;
  tags: string[];
}

const INTEREST_GROUPS: InterestGroup[] = [
  { label: 'News & World', icon: '🌍', tags: ['news', 'world', 'politics', 'explainer'] },
  { label: 'Technology', icon: '💻', tags: ['technology', 'tech', 'gadgets', 'hardware', 'google', 'apple', 'android', 'browsers', 'microsoft', 'windows', 'linux', 'enterprise'] },
  { label: 'Programming', icon: '👨‍💻', tags: ['programming', 'javascript', 'frontend', 'devtools', 'react', 'css', 'python', 'go', 'rust', 'opensource', 'devops', 'infrastructure', 'cloud', 'containers', 'database', 'software', 'systems'] },
  { label: 'AI & Future', icon: '🤖', tags: ['ai', 'future', 'innovation'] },
  { label: 'Science & Space', icon: '🔬', tags: ['science', 'space', 'physics', 'math', 'medicine', 'engineering'] },
  { label: 'Security & Privacy', icon: '🔒', tags: ['security', 'privacy', 'hacking', 'cybercrime', 'breaches', 'civil-liberties'] },
  { label: 'Business & Finance', icon: '📈', tags: ['business', 'finance', 'startups', 'economics', 'budget'] },
  { label: 'Design & Architecture', icon: '🎨', tags: ['design', 'architecture', 'interiors', 'art'] },
  { label: 'Culture & Entertainment', icon: '🎭', tags: ['culture', 'entertainment', 'movies', 'music', 'tv', 'arts'] },
  { label: 'Food & Cooking', icon: '🍳', tags: ['food', 'cooking'] },
  { label: 'Books & Ideas', icon: '📚', tags: ['books', 'literature', 'philosophy', 'ideas', 'essays', 'longform'] },
  { label: 'History & Curiosities', icon: '🏛️', tags: ['history', 'curiosities', 'trivia', 'stories'] },
  { label: 'Health & Fitness', icon: '💪', tags: ['health', 'fitness', 'running', 'wellness', 'men'] },
  { label: 'Travel & Lifestyle', icon: '✈️', tags: ['travel', 'lifestyle'] },
  { label: 'Gaming & Maker', icon: '🎮', tags: ['gaming', 'pc', 'maker', 'diy', 'electronics'] },
  { label: 'Humor & Fun', icon: '😄', tags: ['humor', 'satire', 'fun'] },
  { label: 'Sports', icon: '⚽', tags: ['sports'] },
  { label: 'Web & Browsers', icon: '🌐', tags: ['web', 'performance', 'browsers'] },
];

@customElement('random-reader-options')
export class RandomReaderOptions extends LitElement {
  static styles = optionsStyles;

  @state() private settings: Settings = { ...DEFAULT_SETTINGS };
  @state() private sources: Source[] = [];
  @state() private history: HistoryItem[] = [];
  @state() private statusMessage = '';
  @state() private statusType: 'success' | 'error' | 'info' = 'success';
  @state() private saving = false;
  @state() private dragover = false;
  @state() private activeSection: Section = 'general';
  @state() private searchQuery = '';
  @state() private selectedTag = '';
  @state() private historySearch = '';
  @state() private selectedInterests: string[] = [];
  @state() private localCatalog: { version: number; updatedAt: string; sources: number } | null = null;
  @state() private blockedDomains: string[] = [];
  @state() private newBlockedDomain = '';
  @state() private toastVisible = false;
  private toastTimer: number | null = null;
  private unsubscribeTheme: (() => void) | null = null;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this.loadSettings();
    await this.loadSources();
    await this.loadHistory();
    await this.loadCatalogInfo();
    applyTheme(this, this.settings.theme);
    this.unsubscribeTheme = subscribeToSystemTheme(this, () => this.settings.theme);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubscribeTheme?.();
    this.unsubscribeTheme = null;
  }

  private async loadSettings(): Promise<void> {
    const result = await this.sendMessage<SettingsResponse>({ type: 'GET_SETTINGS' });
    if (result.success && result.settings) {
      this.settings = result.settings;
      applyTheme(this, this.settings.theme);
    }
  }

  private async loadSources(): Promise<void> {
    const result = await this.sendMessage<{ success: boolean; sources?: Source[] }>({ type: 'GET_SOURCES' });
    if (result.success && result.sources) {
      this.sources = result.sources;
    }
  }

  private async loadCatalogInfo(): Promise<void> {
    try {
      const result = await this.sendMessage<CatalogInfoResponse>({ type: 'GET_CATALOG_INFO' });
      if (result.success) {
        if (result.mode) {
          this.settings = { ...this.settings, catalogMode: result.mode };
        }
        this.localCatalog = result.local
          ? { version: result.local.version, updatedAt: result.local.updatedAt, sources: result.local.sources.length }
          : null;
        this.blockedDomains = result.blockedDomains ?? [];
      }
    } catch {
      this.localCatalog = null;
    }
  }

  private async loadHistory(): Promise<void> {
    const result = await this.sendMessage<{ success: boolean; history?: HistoryItem[] }>({ type: 'GET_HISTORY' });
    if (result.success && result.history) {
      this.history = result.history;
    }
  }

  private async handleToggleSource(sourceId: string): Promise<void> {
    const result = await this.sendMessage<{ success: boolean; sources?: Source[]; error?: string }>({ type: 'TOGGLE_SOURCE', sourceId });
    if (result.success && result.sources) {
      this.sources = result.sources;
    } else {
      this.showStatus(result.error || 'Failed to toggle source', 'error');
    }
  }

  private sendMessage<T>(message: object): Promise<T> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve((response ?? { success: false, error: 'No response from background' }) as T);
      });
    });
  }

  private async handleFile(file: File): Promise<void> {
    try {
      const text = await file.text();
      const result = await this.sendMessage<ImportResponse>({ type: 'IMPORT_CATALOG', raw: text });
      if (result.success) {
        this.showStatus(`Catalog "${file.name}" imported (${result.catalog?.sources.length ?? 0} sources)`, 'success');
        await this.loadSettings();
        await this.loadCatalogInfo();
        await this.loadSources();
      } else {
        this.showStatus(result.error || 'Import failed', 'error');
      }
    } catch {
      this.showStatus('Could not read file', 'error');
    }
  }

  private handleFileChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void this.handleFile(file);
    input.value = '';
  }

  private handleDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragover = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) void this.handleFile(file);
  }

  private handleSave(): void {
    void this.saveSettings();
  }

  private async saveSettings(): Promise<void> {
    this.saving = true;
    this.clearStatus();
    try {
      const result = await this.sendMessage<{ success: boolean; error?: string }>({ type: 'SET_SETTINGS', settings: this.settings });
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

  private async handleRefreshNow(): Promise<void> {
    this.showStatus('Refreshing feeds...', 'info');
    try {
      const result = await this.sendMessage<GenericResponse>({ type: 'REFRESH_FEEDS' });
      if (result.success) {
        this.showStatus(`Refreshed: ${result.fetched || 0} sources (${result.added || 0} new articles)`, 'success');
      } else {
        this.showStatus(result.error || 'Refresh failed', 'error');
      }
    } catch {
      this.showStatus('Refresh failed', 'error');
    }
  }

  private async handleCatalogModeChange(e: Event): Promise<void> {
    const useLocal = (e.target as HTMLInputElement).checked;
    this.settings = { ...this.settings, catalogMode: useLocal ? 'local' : 'remote' };
    await this.saveSettings();
    await this.loadCatalogInfo();
    await this.loadSources();
  }

  private async handleAddBlockedDomain(): Promise<void> {
    const domain = this.newBlockedDomain.trim().toLowerCase();
    if (!domain || this.blockedDomains.includes(domain)) {
      this.newBlockedDomain = '';
      return;
    }
    const next = [...this.blockedDomains, domain];
    const result = await this.sendMessage<{ success: boolean; blockedDomains?: string[]; error?: string }>({
      type: 'UPDATE_BLOCKED_DOMAINS',
      domains: next,
    });
    if (result.success) {
      this.blockedDomains = result.blockedDomains ?? next;
      this.newBlockedDomain = '';
      this.showStatus(`Blocked ${domain}. New articles from it will be skipped.`, 'success');
    } else {
      this.showStatus(result.error || 'Failed to update blocked domains', 'error');
    }
  }

  private async handleRemoveBlockedDomain(domain: string): Promise<void> {
    const next = this.blockedDomains.filter((d) => d !== domain);
    const result = await this.sendMessage<{ success: boolean; blockedDomains?: string[]; error?: string }>({
      type: 'UPDATE_BLOCKED_DOMAINS',
      domains: next,
    });
    if (result.success) {
      this.blockedDomains = result.blockedDomains ?? next;
      this.showStatus(`Unblocked ${domain}`, 'success');
    } else {
      this.showStatus(result.error || 'Failed to update blocked domains', 'error');
    }
  }

  private handleThemeChange(e: Event): void {
    const theme = (e.target as HTMLSelectElement).value as Settings['theme'];
    this.settings = { ...this.settings, theme };
    applyTheme(this, theme);
  }

  private handleSettingChange<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.settings = { ...this.settings, [key]: value };
  }

  private async handleToggleSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
    this.settings = { ...this.settings, [key]: value };
    await this.saveSettings();
  }

  private async handleRestoreDefaults(): Promise<void> {
    if (!window.confirm('Reset all settings to their defaults? Your catalog, history, and starred articles will be kept.')) return;
    this.settings = { ...DEFAULT_SETTINGS };
    await this.saveSettings();
    applyTheme(this, this.settings.theme);
    await this.loadCatalogInfo();
    await this.loadSources();
  }

  private async handleClearData(): Promise<void> {
    if (!window.confirm('Clear reading history and all stored articles? Source toggles and settings are kept.')) return;
    const result = await this.sendMessage<GenericResponse>({ type: 'CLEAR_DATA' });
    if (result.success) {
      this.showStatus('Cleared articles and history', 'success');
      await this.loadHistory();
    } else {
      this.showStatus(result.error || 'Failed to clear data', 'error');
    }
  }

  private async handleClearHistory(): Promise<void> {
    if (!window.confirm('Clear your reading history?')) return;
    const result = await this.sendMessage<GenericResponse>({ type: 'CLEAR_HISTORY' });
    if (result.success) {
      this.showStatus('History cleared', 'success');
      await this.loadHistory();
    } else {
      this.showStatus(result.error || 'Failed to clear history', 'error');
    }
  }

  private exportHistory(format: 'csv' | 'json'): void {
    if (this.history.length === 0) return;
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

  private get readingStats(): { total: number; last7: number; topSources: Array<{ name: string; count: number }> } {
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

  private async handleRefreshCatalog(): Promise<void> {
    this.showStatus('Syncing catalog...', 'info');
    try {
      const result = await this.sendMessage<GenericResponse>({ type: 'REFRESH_CATALOG' });
      if (result.success) {
        this.showStatus('Catalog synced', 'success');
        await this.loadSources();
      } else {
        this.showStatus(result.error || 'Failed to sync catalog', 'error');
      }
    } catch {
      this.showStatus('Failed to sync catalog', 'error');
    }
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

  private get availableTags(): string[] {
    const tags = new Set<string>();
    for (const source of this.sources) {
      for (const tag of source.tags ?? []) {
        tags.add(tag);
      }
    }
    return [...tags].sort();
  }

  private get filteredSources(): Source[] {
    return this.sources.filter((s) => {
      const q = this.searchQuery.toLowerCase();
      const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q);
      const matchesTag = !this.selectedTag || (s.tags && s.tags.includes(this.selectedTag));
      return matchesSearch && matchesTag;
    });
  }

  private get filteredHistory(): HistoryItem[] {
    const q = this.historySearch.toLowerCase();
    if (!q) return this.history;
    return this.history.filter(h => h.title.toLowerCase().includes(q) || h.url.toLowerCase().includes(q));
  }

  private toggleIncludeTag(tag: string): void {
    const current = this.settings.includeTags ?? [];
    const next = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
    this.settings = { ...this.settings, includeTags: next };
  }

  private toggleExcludeTag(tag: string): void {
    const current = this.settings.excludeTags ?? [];
    const next = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
    this.settings = { ...this.settings, excludeTags: next };
  }

  private get onboardingGroups(): InterestGroup[] {
    const known = new Set(this.availableTags);
    return INTEREST_GROUPS.filter(g => g.tags.some(t => known.has(t)));
  }

  private toggleInterest(label: string): void {
    const selected = this.selectedInterests.includes(label)
      ? this.selectedInterests.filter(l => l !== label)
      : [...this.selectedInterests, label];
    this.selectedInterests = selected;
  }

  private async finishOnboarding(): Promise<void> {
    const known = new Set(this.availableTags);
    const includeTags = new Set<string>();
    for (const group of this.onboardingGroups) {
      if (this.selectedInterests.includes(group.label)) {
        for (const tag of group.tags) {
          if (known.has(tag)) includeTags.add(tag);
        }
      }
    }
    this.settings = { ...this.settings, includeTags: [...includeTags], onboarded: true };
    await this.saveSettings();
    await this.loadSources();
  }

  private async skipOnboarding(): Promise<void> {
    this.settings = { ...this.settings, onboarded: true };
    await this.saveSettings();
  }

  private formatDate(ts: number): string {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private async selectSection(section: Section): Promise<void> {
    this.activeSection = section;
    this.clearStatus();
    if (section === 'history') {
      await this.loadHistory();
    }
  }

  // ─── Section renderers ────────────────────────────────────────────────────

  private renderGeneral() {
    const stats = this.readingStats;
    return html`
      <div class="section-title">General</div>
      <div class="section-desc">Core behavior settings for the extension.</div>

      <div class="card">
        <div class="card-header"><span class="card-title">Behavior</span></div>
        <div class="card-body">
          <div class="pref-row">
            <div>
              <div class="pref-label">Open Articles In</div>
              <div class="pref-desc">Where links open when you click Surprise Me</div>
            </div>
            <div class="pref-control">
              <select
                id="openIn"
                .value=${this.settings.openIn}
                @change=${(e: Event) => { this.handleSettingChange('openIn', (e.target as HTMLSelectElement).value as Settings['openIn']); }}
              >
                <option value="new_tab">New Tab</option>
                <option value="current_tab">Current Tab</option>
              </select>
            </div>
          </div>
          <div class="pref-row">
            <div>
              <div class="pref-label">Feed Refresh Interval</div>
              <div class="pref-desc">How often feeds are fetched in the background</div>
            </div>
            <div class="pref-control">
              <select
                id="autoRefreshInterval"
                .value=${String(this.settings.autoRefreshInterval)}
                @change=${(e: Event) => { this.handleSettingChange('autoRefreshInterval', Number((e.target as HTMLSelectElement).value)); }}
              >
                <option value="1800000">30 minutes</option>
                <option value="3600000">1 hour</option>
                <option value="7200000">2 hours</option>
                <option value="21600000">6 hours</option>
                <option value="43200000">12 hours</option>
                <option value="86400000">24 hours</option>
              </select>
            </div>
          </div>
          <div class="pref-row">
            <div>
              <div class="pref-label">Article Selection Pool</div>
              <div class="pref-desc">Which articles are eligible when rolling</div>
            </div>
            <div class="pref-control">
              <select
                .value=${this.settings.selectionMode}
                @change=${(e: Event) => { this.handleSettingChange('selectionMode', (e.target as HTMLSelectElement).value as Settings['selectionMode']); }}
              >
                <option value="unread_only">Unread Only</option>
                <option value="all">All Articles</option>
                <option value="starred_only">Starred Only</option>
              </select>
            </div>
          </div>
          <div class="pref-row">
            <div>
              <div class="pref-label">Refresh on Startup</div>
              <div class="pref-desc">Fetch a batch of feeds when the browser starts</div>
            </div>
            <div class="pref-control">
              <label class="toggle-label">
                <input type="checkbox" .checked=${this.settings.refreshOnStartup} @change=${(e: Event) => this.handleToggleSetting('refreshOnStartup', (e.target as HTMLInputElement).checked)} />
                <span class="toggle-track"></span>
              </label>
            </div>
          </div>
          <div class="pref-row">
            <div>
              <div class="pref-label">Sound Effects</div>
              <div class="pref-desc">Play a short sound when an article opens</div>
            </div>
            <div class="pref-control">
              <label class="toggle-label">
                <input type="checkbox" .checked=${this.settings.soundEffects} @change=${(e: Event) => this.handleToggleSetting('soundEffects', (e.target as HTMLInputElement).checked)} />
                <span class="toggle-track"></span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">Appearance</span></div>
        <div class="card-body">
          <div class="pref-row">
            <div>
              <div class="pref-label">Theme</div>
              <div class="pref-desc">Color scheme for the extension UI</div>
            </div>
            <div class="pref-control">
              <select
                .value=${this.settings.theme}
                @change=${this.handleThemeChange}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">Reading Stats</span></div>
        <div class="card-body">
          <div class="stat-row">
            <div class="stat-item"><div class="stat-value">${stats.total}</div><div class="stat-label">Articles read</div></div>
            <div class="stat-item"><div class="stat-value">${stats.last7}</div><div class="stat-label">Last 7 days</div></div>
          </div>
          ${stats.topSources.length > 0
            ? html`
                <div class="pref-row" style="border-bottom: none; padding-bottom: 0;">
                  <div>
                    <div class="pref-label">Top Sources</div>
                    <div class="stat-list">
                      ${stats.topSources.map((s) => html`
                        <div class="stat-source"><span class="stat-source-name">${s.name}</span><span class="stat-source-count">${s.count}</span></div>
                      `)}
                    </div>
                  </div>
                </div>
              `
            : html`<div class="help-text">Read an article to start building stats.</div>`}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">Data</span></div>
        <div class="card-body">
          <div class="btn-group">
            <button class="btn btn-secondary" @click=${this.handleRestoreDefaults}>Restore Defaults</button>
            <button class="btn btn-secondary btn-danger" @click=${this.handleClearData}>Clear All Data</button>
          </div>
          <div class="help-text">Restore defaults resets settings but keeps your catalog and history. Clear All Data removes articles and reading history.</div>
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-primary" @click=${this.handleSave} ?disabled=${this.saving}>
          ${this.saving ? html`<span class="spinner"></span> Saving...` : 'Save Settings'}
        </button>
      </div>
    `;
  }

  private renderSources() {
    const enabled = this.sources.filter(s => s.enabled).length;
    return html`
      <div class="section-title">Sources</div>
      <div class="section-desc">${enabled} of ${this.sources.length} sources enabled. Toggle to include or exclude a source from article selection.</div>

      <div class="card">
        <div class="sources-toolbar">
          <input
            type="text"
            placeholder="Search by name or URL..."
            .value=${this.searchQuery}
            @input=${(e: Event) => { this.searchQuery = (e.target as HTMLInputElement).value; }}
          />
          <select
            @change=${(e: Event) => { this.selectedTag = (e.target as HTMLSelectElement).value; }}
          >
            <option value="">All Categories</option>
            ${this.availableTags.map(t => html`<option value=${t} ?selected=${this.selectedTag === t}>${t}</option>`)}
          </select>
        </div>

        ${this.filteredSources.length > 0
          ? html`
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style="width: 52px;">On</th>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Categories</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.filteredSources.map(source => html`
                      <tr class=${!source.enabled ? 'disabled' : ''}>
                        <td>
                          <label class="toggle-label">
                            <input
                              type="checkbox"
                              .checked=${source.enabled}
                              @change=${() => this.handleToggleSource(source.id)}
                            />
                            <span class="toggle-track"></span>
                          </label>
                        </td>
                        <td>
                          <div class="source-name">${source.name}</div>
                          <div class="source-url">${source.url}</div>
                        </td>
                        <td><span class="badge">${source.type}</span></td>
                        <td class="source-tags">
                          ${(source.tags ?? []).length > 0
                            ? (source.tags ?? []).map(t => html`<span class="tag-pill">${t}</span>`)
                            : html`<span style="color: var(--text-muted);">—</span>`}
                        </td>
                      </tr>
                    `)}
                  </tbody>
                </table>
              </div>
            `
          : html`<div class="empty-state">No sources match your filter.</div>`}
      </div>
    `;
  }

  private renderFilters() {
    const includeTags = this.settings.includeTags ?? [];
    const excludeTags = this.settings.excludeTags ?? [];
    const tags = this.availableTags;

    return html`
      <div class="section-title">Filters</div>
      <div class="section-desc">Control which articles are eligible when you roll. Filters are applied in order.</div>

      <div class="card">
        <div class="card-header"><span class="card-title">Article Age</span></div>
        <div class="card-body">
          <div class="pref-row" style="border-bottom: none; padding-bottom: 0;">
            <div>
              <div class="pref-label">Maximum Article Age</div>
              <div class="pref-desc">Only show articles published within this window. Choose "All time" to disable.</div>
            </div>
            <div class="pref-control">
              <select
                .value=${String(this.settings.maxAgeDays)}
                @change=${(e: Event) => { this.settings = { ...this.settings, maxAgeDays: Number((e.target as HTMLSelectElement).value) }; }}
              >
                <option value="0">All time</option>
                <option value="1">Past 24 hours</option>
                <option value="3">Past 3 days</option>
                <option value="7">Past 7 days</option>
                <option value="14">Past 2 weeks</option>
                <option value="30">Past 30 days</option>
                <option value="90">Past 3 months</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">Include Categories</span>
          <span class="card-hint">Only roll from selected — leave empty for all</span>
        </div>
        <div class="card-body">
          <div class="pref-row">
            <div>
              <div class="pref-label">Category Match</div>
              <div class="pref-desc">"Any" rolls sources with at least one selected category; "All" requires every selected category.</div>
            </div>
            <div class="pref-control">
              <select
                .value=${this.settings.tagMatchMode}
                @change=${(e: Event) => { this.handleSettingChange('tagMatchMode', (e.target as HTMLSelectElement).value as Settings['tagMatchMode']); }}
              >
                <option value="any">Any selected</option>
                <option value="all">All selected</option>
              </select>
            </div>
          </div>
          ${tags.length > 0
            ? html`
                <div class="help-text" style="margin-bottom: 10px;">
                  Click a category to include it. ${this.settings.tagMatchMode === 'all'
                    ? 'Only articles from sources tagged with <strong>all</strong> selected categories will be eligible.'
                    : 'Only articles from sources tagged with <strong>at least one</strong> selected category will be eligible.'}
                  ${includeTags.length > 0
                    ? html` <button class="clear-link" @click=${() => { this.settings = { ...this.settings, includeTags: [] }; }}>Clear all</button>`
                    : ''}
                </div>
                <div class="tag-group">
                  ${tags.map(tag => html`
                    <button
                      class="tag-chip ${includeTags.includes(tag) ? 'selected' : ''}"
                      @click=${() => this.toggleIncludeTag(tag)}
                    >${tag}</button>
                  `)}
                </div>
              `
            : html`<div class="empty-state" style="padding: 16px 0; text-align: left;">No categories found. Load a catalog with tagged sources first.</div>`}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">Exclude Categories</span>
          <span class="card-hint">Block selected — leave empty to block nothing</span>
        </div>
        <div class="card-body">
          ${tags.length > 0
            ? html`
                <div class="help-text" style="margin-bottom: 10px;">
                  Click a category to block it. Articles from sources in these categories will never be shown.
                  ${excludeTags.length > 0
                    ? html` <button class="clear-link" @click=${() => { this.settings = { ...this.settings, excludeTags: [] }; }}>Clear all</button>`
                    : ''}
                </div>
                <div class="tag-group">
                  ${tags.map(tag => html`
                    <button
                      class="tag-chip ${excludeTags.includes(tag) ? 'selected danger' : ''}"
                      @click=${() => this.toggleExcludeTag(tag)}
                    >${tag}</button>
                  `)}
                </div>
              `
            : html`<div class="empty-state" style="padding: 16px 0; text-align: left;">No categories found.</div>`}
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-primary" @click=${this.handleSave} ?disabled=${this.saving}>
          ${this.saving ? html`<span class="spinner"></span> Saving...` : 'Save Filters'}
        </button>
      </div>
    `;
  }

  private renderHistory() {
    const items = this.filteredHistory;
    return html`
      <div class="section-title">History</div>
      <div class="section-desc">${this.history.length} articles visited via Surprise Me.</div>

      <div class="card">
        <div class="sources-toolbar">
          <input
            type="text"
            placeholder="Search history..."
            .value=${this.historySearch}
            @input=${(e: Event) => { this.historySearch = (e.target as HTMLInputElement).value; }}
          />
          <button class="btn btn-secondary" @click=${this.loadHistory} title="Reload history">
            Refresh
          </button>
          <button class="btn btn-secondary" @click=${() => this.exportHistory('csv')} title="Download history as CSV" ?disabled=${this.history.length === 0}>
            Export CSV
          </button>
          <button class="btn btn-secondary" @click=${() => this.exportHistory('json')} title="Download history as JSON" ?disabled=${this.history.length === 0}>
            Export JSON
          </button>
          <button class="btn btn-secondary btn-danger" @click=${this.handleClearHistory} title="Clear reading history">
            Clear History
          </button>
        </div>

        ${items.length > 0
          ? html`
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Source</th>
                      <th>Author</th>
                      <th style="width: 120px;">Date Visited</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${items.map(item => html`
                      <tr>
                        <td>
                          <a class="history-link" href=${item.url} target="_blank" rel="noopener noreferrer">
                            ${item.title || item.url}
                          </a>
                          <div class="source-url">${item.url}</div>
                        </td>
                        <td style="color: var(--text-secondary); font-size: 12px; white-space: nowrap;">
                          ${item.sourceName || '—'}
                        </td>
                        <td style="color: var(--text-secondary); font-size: 12px; white-space: nowrap;">
                          ${item.author || '—'}
                        </td>
                        <td style="color: var(--text-muted); font-size: 12px; white-space: nowrap;">
                          ${this.formatDate(item.fetchedAt)}
                        </td>
                      </tr>
                    `)}
                  </tbody>
                </table>
              </div>
            `
          : html`
              <div class="empty-state">
                ${this.historySearch ? 'No matching history entries.' : 'No history yet. Click "Surprise Me" to get started.'}
              </div>
            `}
      </div>
    `;
  }

  private renderCatalog() {
    const useLocal = this.settings.catalogMode === 'local';
    return html`
      <div class="section-title">Catalog</div>
      <div class="section-desc">Choose where the source catalog comes from: the default online URL or a locally imported file. The active catalog auto-updates and preserves your source toggles.</div>

      <div class="card">
        <div class="card-header"><span class="card-title">Catalog Source</span></div>
        <div class="card-body">
          <div class="pref-row">
            <div>
              <div class="pref-label">Use Local Catalog</div>
              <div class="pref-desc">When on, articles come from your imported catalog file instead of the online URL.</div>
            </div>
            <div class="pref-control">
              <label class="toggle-label">
                <input type="checkbox" .checked=${useLocal} @change=${this.handleCatalogModeChange} />
                <span class="toggle-track"></span>
              </label>
            </div>
          </div>
          ${this.localCatalog
            ? html`
                <div class="pref-row" style="border-bottom: none; padding-bottom: 0;">
                  <div class="help-text">
                    Local catalog: version ${this.localCatalog.version} · ${this.localCatalog.sources} sources · updated ${this.formatDate(new Date(this.localCatalog.updatedAt).getTime())}
                  </div>
                </div>
              `
            : useLocal
              ? html`
                  <div class="pref-row" style="border-bottom: none; padding-bottom: 0;">
                    <div class="help-text" style="color: var(--danger);">No local catalog imported yet — importing a file below enables it automatically.</div>
                  </div>
                `
              : ''}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">Import Catalog File</span></div>
        <div class="card-body">
          <div
            class="dropzone ${this.dragover ? 'dragover' : ''}"
            @dragover=${(e: DragEvent) => { e.preventDefault(); this.dragover = true; }}
            @dragleave=${() => { this.dragover = false; }}
            @drop=${this.handleDrop}
            @click=${() => (this.shadowRoot?.querySelector('input[type="file"]') as HTMLInputElement | null)?.click()}
          >
            <div class="dz-title">Drop catalog.json here, or click to upload</div>
            <div class="dz-sub">Accepts JSON catalogs with sources and tags</div>
            <input type="file" accept=".json,application/json" @change=${this.handleFileChange} />
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">Blocked Domains</span></div>
        <div class="card-body">
          <div class="help-text" style="margin-bottom: 10px;">
            Articles from these domains are never shown, no matter which source they come from (e.g. getbor.dev).
          </div>
          <div class="blocked-domain-input">
            <input
              type="text"
              placeholder="example.com"
              .value=${this.newBlockedDomain}
              @input=${(e: Event) => { this.newBlockedDomain = (e.target as HTMLInputElement).value; }}
              @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') void this.handleAddBlockedDomain(); }}
            />
            <button class="btn btn-secondary" @click=${this.handleAddBlockedDomain}>Add</button>
          </div>
          ${this.blockedDomains.length > 0
            ? html`
                <div class="tag-group" style="margin-top: 12px;">
                  ${this.blockedDomains.map(domain => html`
                    <span class="tag-chip blocked-domain-chip">
                      ${domain}
                      <button class="chip-remove" @click=${() => this.handleRemoveBlockedDomain(domain)} title="Remove">×</button>
                    </span>
                  `)}
                </div>
              `
            : html`<div class="help-text" style="margin-top: 10px;">No domains blocked.</div>`}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">Remote Catalog URL</span></div>
        <div class="card-body">
          <div class="field">
            <label for="catalogUrl">URL</label>
            <input
              type="url"
              id="catalogUrl"
              .value=${this.settings.catalogUrl}
              ?disabled=${useLocal}
              @input=${(e: Event) => { this.settings = { ...this.settings, catalogUrl: (e.target as HTMLInputElement).value }; }}
              placeholder="https://raw.githubusercontent.com/.../catalog.json"
            />
            <div class="help-text">Used when the local catalog toggle is off. Changes to the online catalog are applied on the next check, preserving your source toggles.</div>
          </div>
          <div class="btn-group">
            <button class="btn btn-secondary" ?disabled=${useLocal} @click=${this.handleRefreshCatalog}>Sync Catalog</button>
            <button class="btn btn-secondary" @click=${this.handleRefreshNow}>Refresh Feeds Now</button>
          </div>
        </div>
      </div>
    `;
  }

  // ─── Onboarding render ────────────────────────────────────────────────────

  private renderOnboarding() {
    const groups = this.onboardingGroups;
    const selectedCount = this.selectedInterests.length;

    return html`
      <div class="onboarding">
        <div class="onboard-card">
          <div class="onboard-hero">
            <img src=${new URL('../icons/icon-32.png', import.meta.url).href} alt="" width="56" height="56" class="onboard-logo" />
            <h1>Welcome to Random Reader</h1>
            <p class="onboard-sub">
              Pick what you're into and we'll roll articles from those topics. You can change this anytime in Settings.
            </p>
          </div>

          <div class="onboard-section">
            <div class="onboard-section-label">Your Interests</div>
            ${groups.length > 0
              ? html`
                  <div class="onboard-grid">
                    ${groups.map(group => {
                      const active = this.selectedInterests.includes(group.label);
                      return html`
                        <button
                          class="interest-chip ${active ? 'selected' : ''}"
                          @click=${() => this.toggleInterest(group.label)}
                        >
                          <span class="interest-icon">${group.icon}</span>
                          <span class="interest-label">${group.label}</span>
                          ${active ? html`<span class="interest-check">✓</span>` : ''}
                        </button>
                      `;
                    })}
                  </div>
                `
              : html`<div class="empty-state" style="padding: 16px 0;">No catalog loaded yet. Feeds are refreshing — you can pick interests after sources are ready.</div>`}
          </div>

          <div class="onboard-footer">
            <button class="onboard-skip" @click=${this.skipOnboarding}>Skip for now</button>
            <button
              class="btn btn-primary onboard-start"
              @click=${this.finishOnboarding}
              ?disabled=${groups.length === 0 || this.saving}
            >
              ${this.saving
                ? html`<span class="spinner"></span> Saving...`
                : selectedCount > 0
                  ? `Start Reading (${selectedCount} selected)`
                  : 'Start Reading'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ─── Root render ──────────────────────────────────────────────────────────

  render() {
    if (!this.settings.onboarded) {
      return this.renderOnboarding();
    }

    const navItems: { id: Section; label: string; icon: string; badge?: string }[] = [
      { id: 'general',   label: 'General',   icon: '⚙️' },
      { id: 'sources',   label: 'Sources',   icon: '📡', badge: String(this.sources.length) },
      { id: 'filters',   label: 'Filters',   icon: '⚗️' },
      { id: 'history',   label: 'History',   icon: '🕓', badge: this.history.length > 0 ? String(this.history.length) : '' },
      { id: 'catalog',   label: 'Catalog',   icon: '📦' },
    ];

    return html`
      <div class="page-shell">
        <!-- Top bar -->
        <header class="topbar">
          <div class="topbar-logo">
            <img src=${new URL('../icons/icon-32.png', import.meta.url).href} alt="" width="32" height="32" />
          </div>
          <span class="topbar-title">Random Reader</span>
          <span class="topbar-sub">Settings</span>
        </header>

        <!-- Sidebar -->
        <nav class="sidebar">
          <div class="sidebar-label">Settings</div>
          ${navItems.map(item => html`
            <button
              class="nav-item ${this.activeSection === item.id ? 'active' : ''}"
              @click=${() => this.selectSection(item.id)}
            >
              <span class="nav-icon">${item.icon}</span>
              <span class="nav-label">${item.label}</span>
              ${item.badge ? html`<span class="nav-badge">${item.badge}</span>` : ''}
            </button>
          `)}
        </nav>

        <!-- Main content -->
        <main class="main-content">
          ${this.activeSection === 'general'  ? this.renderGeneral()  : ''}
          ${this.activeSection === 'sources'  ? this.renderSources()  : ''}
          ${this.activeSection === 'filters'  ? this.renderFilters()  : ''}
          ${this.activeSection === 'history'  ? this.renderHistory()  : ''}
          ${this.activeSection === 'catalog'  ? this.renderCatalog()  : ''}
        </main>
      </div>

      ${this.toastVisible && this.statusMessage
        ? html`<div class="toast ${this.statusType}" role="status">
            <span class="toast-message">${this.statusMessage}</span>
            <button class="toast-close" @click=${this.clearStatus} aria-label="Dismiss">×</button>
          </div>`
        : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'random-reader-options': RandomReaderOptions;
  }
}
