import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Settings } from '../../models';
import { optionsStyles } from '../options.styles';

@customElement('filters-section')
export class FiltersSection extends LitElement {
  static styles = optionsStyles;

  @property({ type: Object }) settings!: Settings;
  @property({ type: Array }) availableTags: string[] = [];
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

  private toggleIncludeTag(tag: string): void {
    const current = this.settings.includeTags ?? [];
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    this.emitSettingChange('includeTags', next);
  }

  private toggleExcludeTag(tag: string): void {
    const current = this.settings.excludeTags ?? [];
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    this.emitSettingChange('excludeTags', next);
  }

  render() {
    if (!this.settings) return html``;

    const includeTags = this.settings.includeTags ?? [];
    const excludeTags = this.settings.excludeTags ?? [];
    const tags = this.availableTags;

    return html`
      <div class="section-title">Filters</div>
      <div class="section-desc">Control which articles are eligible when you roll. Filters are applied in order.</div>

      <div class="card">
        <div class="card-header"><span class="card-title">Article Age</span></div>
        <div class="card-body">
          <div class="pref-row pref-row-borderless">
            <div>
              <div class="pref-label">Maximum Article Age</div>
              <div class="pref-desc">Only show articles published within this window. Choose "All time" to disable.</div>
            </div>
            <div class="pref-control">
              <select
                .value=${String(this.settings.maxAgeDays)}
                @change=${(e: Event) => this.emitSettingChange('maxAgeDays', Number((e.target as HTMLSelectElement).value))}
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
                @change=${(e: Event) => this.emitSettingChange('tagMatchMode', (e.target as HTMLSelectElement).value as Settings['tagMatchMode'])}
              >
                <option value="any">Any selected</option>
                <option value="all">All selected</option>
              </select>
            </div>
          </div>
          ${
            tags.length > 0
              ? html`
                <div class="help-text mb-2">
                  Click a category to include it. ${
                    this.settings.tagMatchMode === 'all'
                      ? html`Only articles from sources tagged with <strong>all</strong> selected categories will be eligible.`
                      : html`Only articles from sources tagged with <strong>at least one</strong> selected category will be eligible.`
                  }
                  ${
                    includeTags.length > 0
                      ? html` <button class="clear-link" @click=${() => this.emitSettingChange('includeTags', [])}>Clear all</button>`
                      : ''
                  }
                </div>
                <div class="tag-group">
                  ${tags.map(
                    (tag) => html`
                      <button
                        class="tag-chip ${includeTags.includes(tag) ? 'selected' : ''}"
                        @click=${() => this.toggleIncludeTag(tag)}
                      >
                        ${tag}
                      </button>
                    `,
                  )}
                </div>
              `
              : html`<div class="empty-state">No categories found. Load a catalog with tagged sources first.</div>`
          }
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">Exclude Categories</span>
          <span class="card-hint">Block selected — leave empty to block nothing</span>
        </div>
        <div class="card-body">
          ${
            tags.length > 0
              ? html`
                <div class="help-text mb-2">
                  Click a category to block it. Articles from sources in these categories will never be shown.
                  ${
                    excludeTags.length > 0
                      ? html` <button class="clear-link" @click=${() => this.emitSettingChange('excludeTags', [])}>Clear all</button>`
                      : ''
                  }
                </div>
                <div class="tag-group">
                  ${tags.map(
                    (tag) => html`
                      <button
                        class="tag-chip ${excludeTags.includes(tag) ? 'selected danger' : ''}"
                        @click=${() => this.toggleExcludeTag(tag)}
                      >
                        ${tag}
                      </button>
                    `,
                  )}
                </div>
              `
              : html`<div class="empty-state">No categories found.</div>`
          }
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-primary" @click=${this.emitSave} ?disabled=${this.saving}>
          ${this.saving ? html`<span class="spinner"></span> Saving...` : 'Save Filters'}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'filters-section': FiltersSection;
  }
}
