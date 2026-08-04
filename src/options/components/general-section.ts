import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Settings } from '../../models';
import { optionsStyles } from '../options.styles';

export interface ReadingStats {
  total: number;
  last7: number;
  topSources: Array<{ name: string; count: number }>;
}

/** Feed refresh interval options shown in the UI (milliseconds). */
const REFRESH_INTERVALS_MS = [
  { value: 30 * 60 * 1000, label: '30 minutes' },
  { value: 60 * 60 * 1000, label: '1 hour' },
  { value: 2 * 60 * 60 * 1000, label: '2 hours' },
  { value: 6 * 60 * 60 * 1000, label: '6 hours' },
  { value: 12 * 60 * 60 * 1000, label: '12 hours' },
  { value: 24 * 60 * 60 * 1000, label: '24 hours' },
] as const;

@customElement('general-section')
export class GeneralSection extends LitElement {
  static styles = optionsStyles;

  @property({ type: Object }) settings!: Settings;
  @property({ type: Object }) stats!: ReadingStats;
  @property({ type: Boolean }) saving = false;

  private emitSettingChange<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.dispatchEvent(
      new CustomEvent('setting-change', {
        detail: { key, value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private emitSave(): void {
    this.dispatchEvent(new CustomEvent('save-settings', { bubbles: true, composed: true }));
  }

  private emitRestoreDefaults(): void {
    this.dispatchEvent(new CustomEvent('restore-defaults', { bubbles: true, composed: true }));
  }

  private emitClearData(): void {
    this.dispatchEvent(new CustomEvent('clear-data', { bubbles: true, composed: true }));
  }

  render() {
    if (!this.settings) return html``;

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
                @change=${(e: Event) => this.emitSettingChange('openIn', (e.target as HTMLSelectElement).value as Settings['openIn'])}
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
                @change=${(e: Event) => this.emitSettingChange('autoRefreshInterval', Number((e.target as HTMLSelectElement).value))}
              >
                ${REFRESH_INTERVALS_MS.map((opt) => html`<option value=${opt.value}>${opt.label}</option>`)}
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
                @change=${(e: Event) => this.emitSettingChange('selectionMode', (e.target as HTMLSelectElement).value as Settings['selectionMode'])}
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
                <input
                  type="checkbox"
                  .checked=${this.settings.refreshOnStartup}
                  @change=${(e: Event) => this.emitSettingChange('refreshOnStartup', (e.target as HTMLInputElement).checked)}
                />
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
                <input
                  type="checkbox"
                  .checked=${this.settings.soundEffects}
                  @change=${(e: Event) => this.emitSettingChange('soundEffects', (e.target as HTMLInputElement).checked)}
                />
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
                @change=${(e: Event) => this.emitSettingChange('theme', (e.target as HTMLSelectElement).value as Settings['theme'])}
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
            <div class="stat-item"><div class="stat-value">${this.stats.total}</div><div class="stat-label">Articles read</div></div>
            <div class="stat-item"><div class="stat-value">${this.stats.last7}</div><div class="stat-label">Last 7 days</div></div>
          </div>
          ${
            this.stats.topSources.length > 0
              ? html`
                <div class="pref-row pref-row-borderless">
                  <div>
                    <div class="pref-label">Top Sources</div>
                    <div class="stat-list">
                      ${this.stats.topSources.map(
                        (s) => html`
                          <div class="stat-source">
                            <span class="stat-source-name">${s.name}</span>
                            <span class="stat-source-count">${s.count}</span>
                          </div>
                        `,
                      )}
                    </div>
                  </div>
                </div>
              `
              : html`<div class="help-text">Read an article to start building stats.</div>`
          }
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">Data</span></div>
        <div class="card-body">
          <div class="btn-group">
            <button class="btn btn-secondary" @click=${this.emitRestoreDefaults}>Restore Defaults</button>
            <button class="btn btn-secondary btn-danger" @click=${this.emitClearData}>Clear All Data</button>
          </div>
          <div class="help-text">Restore defaults resets settings but keeps your catalog and history. Clear All Data removes articles and reading history.</div>
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-primary" @click=${this.emitSave} ?disabled=${this.saving}>
          ${this.saving ? html`<span class="spinner"></span> Saving...` : 'Save Settings'}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'general-section': GeneralSection;
  }
}
