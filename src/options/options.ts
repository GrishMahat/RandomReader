import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Settings, Source } from '../models';
import { DEFAULT_SETTINGS } from '../models';
import { optionsStyles } from './options.styles';

interface SettingsResponse {
  success: boolean;
  settings?: Settings;
  error?: string;
}

interface GenericResponse {
  success: boolean;
  count?: number;
  error?: string;
  catalog?: unknown;
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
  read: boolean;
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
  @state() private dragover = false;
  @state() private activeSection: Section = 'general';
  @state() private searchQuery = '';
  @state() private selectedTag = '';
  @state() private historySearch = '';

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this.loadSettings();
    await this.loadSources();
    await this.loadHistory();
  }

  private async loadSettings(): Promise<void> {
    const result = await this.sendMessage<SettingsResponse>({ type: 'GET_SETTINGS' });
    if (result.success && result.settings) {
      this.settings = result.settings;
    }
  }

  private async loadSources(): Promise<void> {
    const result = await this.sendMessage<{ success: boolean; sources?: Source[] }>({ type: 'GET_SOURCES' });
    if (result.success && result.sources) {
      this.sources = result.sources;
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
        this.showStatus(`Refreshed: ${result.count || 0} new articles`, 'success');
      } else {
        this.showStatus(result.error || 'Refresh failed', 'error');
      }
    } catch {
      this.showStatus('Refresh failed', 'error');
    }
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
  }

  private clearStatus(): void {
    this.statusMessage = '';
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
                @change=${(e: Event) => { this.settings = { ...this.settings, openIn: (e.target as HTMLSelectElement).value as Settings['openIn'] }; }}
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
                @change=${(e: Event) => { this.settings = { ...this.settings, autoRefreshInterval: Number((e.target as HTMLSelectElement).value) }; }}
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
                @change=${(e: Event) => { this.settings = { ...this.settings, selectionMode: (e.target as HTMLSelectElement).value as Settings['selectionMode'] }; }}
              >
                <option value="unread_only">Unread Only</option>
                <option value="all">All Articles</option>
                <option value="starred_only">Starred Only</option>
              </select>
            </div>
          </div>
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
          ${tags.length > 0
            ? html`
                <div class="help-text" style="margin-bottom: 10px;">
                  Click a category to include it. Only articles from sources tagged with
                  <strong>at least one</strong> selected category will be eligible.
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
        </div>

        ${items.length > 0
          ? html`
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
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
    return html`
      <div class="section-title">Catalog</div>
      <div class="section-desc">Import a local catalog file or sync from a remote URL to add new sources.</div>

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
        <div class="card-header"><span class="card-title">Remote Catalog URL</span></div>
        <div class="card-body">
          <div class="field">
            <label for="catalogUrl">URL</label>
            <input
              type="url"
              id="catalogUrl"
              .value=${this.settings.catalogUrl}
              @input=${(e: Event) => { this.settings = { ...this.settings, catalogUrl: (e.target as HTMLInputElement).value }; }}
              placeholder="https://raw.githubusercontent.com/.../catalog.json"
            />
            <div class="help-text">Catalog will be fetched and merged with your existing sources on sync.</div>
          </div>
          <div class="btn-group">
            <button class="btn btn-secondary" @click=${this.handleRefreshCatalog}>Sync Catalog</button>
            <button class="btn btn-secondary" @click=${this.handleRefreshNow}>Refresh Feeds Now</button>
          </div>
        </div>
      </div>
    `;
  }

  // ─── Root render ──────────────────────────────────────────────────────────

  render() {
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
            <img src=${new URL('../../src/icons/icon-32.png', import.meta.url).href} alt="" width="32" height="32" />
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
          ${this.statusMessage
            ? html`<div class="status-banner ${this.statusType}">${this.statusMessage}</div>`
            : ''}

          ${this.activeSection === 'general'  ? this.renderGeneral()  : ''}
          ${this.activeSection === 'sources'  ? this.renderSources()  : ''}
          ${this.activeSection === 'filters'  ? this.renderFilters()  : ''}
          ${this.activeSection === 'history'  ? this.renderHistory()  : ''}
          ${this.activeSection === 'catalog'  ? this.renderCatalog()  : ''}
        </main>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'random-reader-options': RandomReaderOptions;
  }
}
