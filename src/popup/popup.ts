import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Settings } from '../models';
import { DEFAULT_SETTINGS } from '../models';
import { popupStyles } from './popup.styles';

interface SettingsResponse {
  success: boolean;
  settings?: Settings;
  error?: string;
}

@customElement('random-reader-popup')
export class RandomReaderPopup extends LitElement {
  static styles = popupStyles;

  @state() private settings: Settings = { ...DEFAULT_SETTINGS };
  @state() private loading = false;
  @state() private refreshing = false;
  @state() private statusMessage = '';
  @state() private statusType: 'success' | 'error' | 'loading' | '' = '';
  @state() private activeTab: 'roll' | 'filters' | 'history' = 'roll';
  @state() private history: Array<{ id: string; title: string; url: string; fetchedAt?: number }> = [];

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this.loadSettings();
    await this.loadHistory();
  }

  private async loadSettings(): Promise<void> {
    try {
      const result = await this.sendMessage<SettingsResponse>({ type: 'GET_SETTINGS' });
      if (result.success && result.settings) this.settings = result.settings;
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  private async loadHistory(): Promise<void> {
    try {
      const result = await this.sendMessage<{ success: boolean; history?: Array<{ id: string; title: string; url: string; fetchedAt?: number }> }>({ type: 'GET_HISTORY' });
      if (result.success && result.history) {
        this.history = result.history;
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  }

  private sendMessage<T>(message: object): Promise<T> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve((response ?? { success: false, error: 'No response from background' }) as T);
      });
    });
  }

  private async handleOpenRandom(): Promise<void> {
    this.loading = true;
    this.clearStatus();

    try {
      const result = await this.sendMessage<{ success: boolean; error?: string }>({ type: 'OPEN_RANDOM' });
      if (result.success) {
        await this.loadHistory();
        window.close();
      } else {
        this.showStatus(result.error || 'Failed to open article', 'error');
      }
    } catch (error) {
      this.showStatus('Failed to open article', 'error');
    } finally {
      this.loading = false;
    }
  }

  private async handleRefresh(): Promise<void> {
    this.refreshing = true;
    this.showStatus('Refreshing feeds...', 'loading');

    try {
      const result = await this.sendMessage<{ success: boolean; count?: number; error?: string }>({ type: 'REFRESH_FEEDS' });
      if (result.success) {
        this.showStatus(`Added ${result.count || 0} new articles`, 'success');
        await this.loadHistory();
      } else {
        this.showStatus(result.error || 'Refresh failed', 'error');
      }
    } catch (error) {
      this.showStatus('Refresh failed', 'error');
    } finally {
      this.refreshing = false;
    }
  }

  private async updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
    const next = { ...this.settings, [key]: value };
    const result = await this.sendMessage<{ success: boolean; error?: string }>({ type: 'SET_SETTINGS', settings: next });
    if (result.success) {
      this.settings = next;
    } else {
      this.showStatus(result.error || 'Failed to save setting', 'error');
    }
  }

  private showStatus(message: string, type: 'success' | 'error' | 'loading'): void {
    this.statusMessage = message;
    this.statusType = type;
    if (type !== 'loading') {
      setTimeout(() => this.clearStatus(), 3000);
    }
  }

  private clearStatus(): void {
    this.statusMessage = '';
    this.statusType = '';
  }

  private openSettings(): void {
    chrome.runtime.openOptionsPage();
  }

  private async selectTab(tab: 'roll' | 'filters' | 'history'): Promise<void> {
    this.activeTab = tab;
    if (tab === 'history') {
      await this.loadHistory();
    }
  }

  render() {
    return html`
      <header>
        <div class="brand">
          <span class="logo" aria-hidden="true">
            <img src=${new URL('../../src/icons/icon-32.png', import.meta.url).href} alt="" width="28" height="28" />
          </span>
          <div>
            <div class="title">Random Reader</div>
            <div class="subtitle">Clean & Distraction Free</div>
          </div>
        </div>
        <button
          class="icon-btn"
          @click=${this.handleRefresh}
          ?disabled=${this.refreshing}
          title="Refresh feeds"
        >
          ${this.refreshing ? html`<span class="spinner"></span>` : html`↻`}
        </button>
      </header>

      <div class="content">
        <button
          class="roll-btn"
          @click=${this.handleOpenRandom}
          ?disabled=${this.loading}
        >
          ${this.loading ? html`<span class="spinner"></span> Opening...` : html`🎲 Surprise Me`}
        </button>

        <nav class="tab-nav">
          <button class="tab-btn ${this.activeTab === 'roll' ? 'active' : ''}" @click=${() => this.selectTab('roll')}>General</button>
          <button class="tab-btn ${this.activeTab === 'filters' ? 'active' : ''}" @click=${() => this.selectTab('filters')}>Filters</button>
          <button class="tab-btn ${this.activeTab === 'history' ? 'active' : ''}" @click=${() => this.selectTab('history')}>History</button>
        </nav>

        ${this.activeTab === 'roll'
          ? html`
              <div class="panel">
                <div class="opt-card">
                  <span class="opt-label">Selection Pool</span>
                  <select
                    class="opt-select"
                    .value=${this.settings.selectionMode}
                    @change=${(e: Event) => this.updateSetting('selectionMode', (e.target as HTMLSelectElement).value as Settings['selectionMode'])}
                  >
                    <option value="unread_only">Unread Only</option>
                    <option value="all">All Articles</option>
                    <option value="starred_only">Starred Only</option>
                  </select>
                </div>
                <div class="opt-card">
                  <span class="opt-label">Open Target</span>
                  <select
                    class="opt-select"
                    .value=${this.settings.openIn}
                    @change=${(e: Event) => this.updateSetting('openIn', (e.target as HTMLSelectElement).value as Settings['openIn'])}
                  >
                    <option value="new_tab">New Tab</option>
                    <option value="current_tab">Current Tab</option>
                  </select>
                </div>
              </div>
            `
          : ''}

        ${this.activeTab === 'filters'
          ? html`
              <div class="panel">
                <div class="opt-card">
                  <span class="opt-label">Max Article Age</span>
                  <select
                    class="opt-select"
                    .value=${String(this.settings.maxAgeDays)}
                    @change=${(e: Event) => this.updateSetting('maxAgeDays', Number((e.target as HTMLSelectElement).value))}
                  >
                    <option value="0">Any time</option>
                    <option value="1">Past 24 Hours</option>
                    <option value="7">Past 7 Days</option>
                    <option value="30">Past 30 Days</option>
                  </select>
                </div>
              </div>
            `
          : ''}

        ${this.activeTab === 'history'
          ? html`
              ${this.history.length > 0
                ? html`
                    <ul class="history-list">
                      ${this.history.slice(0, 15).map(
                        (item) => html`
                          <li class="history-item">
                            <a class="history-link" href=${item.url} target="_blank" rel="noopener">${item.title}</a>
                          </li>
                        `
                      )}
                    </ul>
                  `
                : html`<div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 16px;">No reading history yet.</div>`}
            `
          : ''}

        ${this.statusMessage
          ? html`<div class="status-pill ${this.statusType}">
              ${this.statusType === 'loading' ? html`<span class="spinner"></span>` : ''}
              ${this.statusMessage}
            </div>`
          : ''}
      </div>

      <footer>
        <button class="footer-link" @click=${this.openSettings}>
          Options & Sources Dashboard →
        </button>
      </footer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'random-reader-popup': RandomReaderPopup;
  }
}
