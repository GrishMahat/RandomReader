import { html, LitElement, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Source } from '../../models';
import { isSnoozed } from '../../utils';
import { formatTimestamp, SNOOZE_DAYS } from '../../utils/ui';
import { optionsStyles } from '../options.styles';

@customElement('sources-section')
export class SourcesSection extends LitElement {
  static styles = optionsStyles;

  @property({ type: Array }) sources: Source[] = [];
  @property({ type: Array }) availableTags: string[] = [];

  @state() private searchQuery = '';
  @state() private selectedTag = '';
  /** Filtered list; recomputed only when its inputs change (see willUpdate). */
  @state() private filteredSources: Source[] = [];

  protected willUpdate(changedProperties: PropertyValues): void {
    if (
      changedProperties.has('sources') ||
      changedProperties.has('searchQuery') ||
      changedProperties.has('selectedTag')
    ) {
      const q = this.searchQuery.toLowerCase();
      this.filteredSources = this.sources.filter((s) => {
        const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q);
        const matchesTag = !this.selectedTag || (s.tags?.includes(this.selectedTag) ?? false);
        return matchesSearch && matchesTag;
      });
    }
  }

  private handleToggleSource(sourceId: string): void {
    this.dispatchEvent(
      new CustomEvent('toggle-source', {
        detail: { sourceId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleSnoozeSource(sourceId: string, days: number): void {
    this.dispatchEvent(
      new CustomEvent('snooze-source', {
        detail: { sourceId, days },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private isSnoozed(source: Source): boolean {
    return isSnoozed(source);
  }

  private formatSnoozeDate(ts: number | undefined): string {
    return formatTimestamp(ts);
  }

  render() {
    const enabled = this.sources.filter((s) => s.enabled).length;
    const snoozed = this.sources.filter((s) => this.isSnoozed(s)).length;

    return html`
      <div class="section-title">Sources</div>
      <div class="section-desc">${enabled} of ${this.sources.length} sources enabled${snoozed > 0 ? ` · ${snoozed} snoozed` : ''}. Toggle to include or exclude a source, or snooze one temporarily.</div>

      <div class="card">
        <div class="sources-toolbar">
          <input
            type="text"
            placeholder="Search by name or URL..."
            .value=${this.searchQuery}
            @input=${(e: Event) => {
              this.searchQuery = (e.target as HTMLInputElement).value;
            }}
          />
          <select
            @change=${(e: Event) => {
              this.selectedTag = (e.target as HTMLSelectElement).value;
            }}
          >
            <option value="">All Categories</option>
            ${this.availableTags.map((t) => html`<option value=${t} ?selected=${this.selectedTag === t}>${t}</option>`)}
          </select>
        </div>

        ${
          this.filteredSources.length > 0
            ? html`
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Categories</th>
                      <th>Snooze</th>
                      <th class="col-width-on">On</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.filteredSources.map(
                      (source) => html`
                        <tr class=${!source.enabled || this.isSnoozed(source) ? 'disabled' : ''}>
                          <td>
                            <div class="source-name">${source.name}</div>
                            <div class="source-url">${source.url}</div>
                          </td>
                          <td>
                            <span class="badge">${source.type}</span>
                            ${
                              typeof source.maxAgeDays === 'number'
                                ? html`<span class="tag-pill" title="Max article age override">≤ ${source.maxAgeDays}d</span>`
                                : ''
                            }
                          </td>
                          <td class="source-tags">
                            ${
                              (source.tags ?? []).length > 0
                                ? (source.tags ?? []).map((t) => html`<span class="tag-pill">${t}</span>`)
                                : html`<span class="text-muted">—</span>`
                            }
                          </td>
                          <td>
                            ${
                              this.isSnoozed(source)
                                ? html`
                                  <span class="snooze-badge" title="Snoozed until ${this.formatSnoozeDate(source.snoozedUntil)}">
                                    zz · ${this.formatSnoozeDate(source.snoozedUntil)}
                                  </span>
                                  <button class="btn-mini" @click=${() => this.handleSnoozeSource(source.id, 0)}>Wake</button>
                                `
                                : html`
                                  <select class="snooze-select" @change=${(e: Event) => this.handleSnoozeSource(source.id, Number((e.target as HTMLSelectElement).value))}>
                                    <option value="0">Snooze…</option>
                                    ${SNOOZE_DAYS.map((opt) => html`<option value=${opt.value}>${opt.label}</option>`)}
                                  </select>
                                `
                            }
                          </td>
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
                        </tr>
                      `,
                    )}
                  </tbody>
                </table>
              </div>
            `
            : html`<div class="empty-state">No sources match your filter.</div>`
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sources-section': SourcesSection;
  }
}
