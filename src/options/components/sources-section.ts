import { html, LitElement, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Source } from '../../models';
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

  /** Snooze durations offered in the UI (days). */
  private static readonly SNOOZE_DAYS = [
    { value: 1, label: '1 day' },
    { value: 7, label: '1 week' },
    { value: 30, label: '1 month' },
  ] as const;

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
    return typeof source.snoozedUntil === 'number' && source.snoozedUntil > Date.now();
  }

  private formatSnoozeDate(ts: number | undefined): string {
    return ts ? new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
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
                      <th class="col-width-on">On</th>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Snooze</th>
                      <th>Categories</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.filteredSources.map(
                      (source) => html`
                        <tr class=${!source.enabled || this.isSnoozed(source) ? 'disabled' : ''}>
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
                          <td>
                            <span class="badge">${source.type}</span>
                            ${
                              typeof source.maxAgeDays === 'number'
                                ? html`<span class="tag-pill" title="Max article age override">≤ ${source.maxAgeDays}d</span>`
                                : ''
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
                                    ${SourcesSection.SNOOZE_DAYS.map((opt) => html`<option value=${opt.value}>${opt.label}</option>`)}
                                  </select>
                                `
                            }
                          </td>
                          <td class="source-tags">
                            ${
                              (source.tags ?? []).length > 0
                                ? (source.tags ?? []).map((t) => html`<span class="tag-pill">${t}</span>`)
                                : html`<span class="text-muted">—</span>`
                            }
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
