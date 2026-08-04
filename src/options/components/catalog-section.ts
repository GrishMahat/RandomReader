import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Settings } from '../../models';
import { optionsStyles } from '../options.styles';

export interface LocalCatalogInfo {
  version: number;
  updatedAt: string;
  sources: number;
}

@customElement('catalog-section')
export class CatalogSection extends LitElement {
  static styles = optionsStyles;

  @property({ type: Object }) settings!: Settings;
  @property({ type: Object }) localCatalog: LocalCatalogInfo | null = null;
  @property({ type: Array }) blockedDomains: string[] = [];

  @state() private dragover = false;
  @state() private newBlockedDomain = '';

  private emitSettingChange<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.dispatchEvent(
      new CustomEvent('setting-change', {
        detail: { key, value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private emitCatalogModeChange(useLocal: boolean): void {
    this.dispatchEvent(
      new CustomEvent('catalog-mode-change', {
        detail: { useLocal },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private emitImportFile(file: File): void {
    this.dispatchEvent(
      new CustomEvent('import-catalog-file', {
        detail: { file },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private emitAddBlockedDomain(domain: string): void {
    this.dispatchEvent(
      new CustomEvent('add-blocked-domain', {
        detail: { domain },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private emitRemoveBlockedDomain(domain: string): void {
    this.dispatchEvent(
      new CustomEvent('remove-blocked-domain', {
        detail: { domain },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private emitRefreshCatalog(): void {
    this.dispatchEvent(new CustomEvent('refresh-catalog', { bubbles: true, composed: true }));
  }

  private emitRefreshFeedsNow(): void {
    this.dispatchEvent(new CustomEvent('refresh-feeds-now', { bubbles: true, composed: true }));
  }

  private handleFileChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.emitImportFile(file);
    input.value = '';
  }

  private handleDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragover = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) this.emitImportFile(file);
  }

  private handleAddDomain(): void {
    const domain = this.newBlockedDomain.trim().toLowerCase();
    if (domain) {
      this.emitAddBlockedDomain(domain);
      this.newBlockedDomain = '';
    }
  }

  private formatDate(ts: number): string {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  render() {
    if (!this.settings) return html``;
    const useLocal = this.settings.catalogMode === 'local';

    return html`
      <div class="section-title">Catalog</div>
      <div class="section-desc">
        Choose where the source catalog comes from: the default online URL or a locally imported file. The active catalog auto-updates and preserves your source toggles.
      </div>

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
                <input
                  type="checkbox"
                  .checked=${useLocal}
                  @change=${(e: Event) => this.emitCatalogModeChange((e.target as HTMLInputElement).checked)}
                />
                <span class="toggle-track"></span>
              </label>
            </div>
          </div>
          ${
            this.localCatalog
              ? html`
                <div class="pref-row pref-row-borderless">
                  <div class="help-text">
                    Local catalog: version ${this.localCatalog.version} · ${this.localCatalog.sources} sources · updated ${this.formatDate(new Date(this.localCatalog.updatedAt).getTime())}
                  </div>
                </div>
              `
              : useLocal
                ? html`
                <div class="pref-row pref-row-borderless">
                  <div class="help-text text-danger">No local catalog imported yet — importing a file below enables it automatically.</div>
                </div>
              `
                : ''
          }
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">Import Catalog File</span></div>
        <div class="card-body">
          <div
            class="dropzone ${this.dragover ? 'dragover' : ''}"
            @dragover=${(e: DragEvent) => {
              e.preventDefault();
              this.dragover = true;
            }}
            @dragleave=${() => {
              this.dragover = false;
            }}
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
          <div class="help-text mb-2">
            Articles from these domains are never shown, no matter which source they come from (e.g. getbor.dev).
          </div>
          <div class="blocked-domain-input">
            <input
              type="text"
              placeholder="example.com"
              .value=${this.newBlockedDomain}
              @input=${(e: Event) => {
                this.newBlockedDomain = (e.target as HTMLInputElement).value;
              }}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Enter') this.handleAddDomain();
              }}
            />
            <button class="btn btn-secondary" @click=${this.handleAddDomain}>Add</button>
          </div>
          ${
            this.blockedDomains.length > 0
              ? html`
                <div class="tag-group mt-3">
                  ${this.blockedDomains.map(
                    (domain) => html`
                      <span class="tag-chip blocked-domain-chip">
                        ${domain}
                        <button class="chip-remove" @click=${() => this.emitRemoveBlockedDomain(domain)} title="Remove">×</button>
                      </span>
                    `,
                  )}
                </div>
              `
              : html`<div class="help-text mt-2">No domains blocked.</div>`
          }
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
              @input=${(e: Event) => this.emitSettingChange('catalogUrl', (e.target as HTMLInputElement).value)}
              placeholder="https://raw.githubusercontent.com/.../catalog.json"
            />
            <div class="help-text">Used when the local catalog toggle is off. Changes to the online catalog are applied on the next check, preserving your source toggles.</div>
          </div>
          <div class="btn-group">
            <button class="btn btn-secondary" ?disabled=${useLocal} @click=${this.emitRefreshCatalog}>Sync Catalog</button>
            <button class="btn btn-secondary" @click=${this.emitRefreshFeedsNow}>Refresh Feeds Now</button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'catalog-section': CatalogSection;
  }
}
