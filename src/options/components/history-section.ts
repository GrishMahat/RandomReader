import { html, LitElement, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { optionsStyles } from '../options.styles';

export interface HistoryItem {
  id: string;
  title: string;
  url: string;
  fetchedAt: number;
  sourceId: string;
  sourceName?: string;
  author?: string;
  read: boolean;
}

@customElement('history-section')
export class HistorySection extends LitElement {
  static styles = optionsStyles;

  @property({ type: Array }) history: HistoryItem[] = [];

  @state() private historySearch = '';
  /** Filtered list; recomputed only when its inputs change (see willUpdate). */
  @state() private filteredHistory: HistoryItem[] = [];

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has('history') || changedProperties.has('historySearch')) {
      const q = this.historySearch.toLowerCase();
      if (!q) {
        this.filteredHistory = this.history;
        return;
      }
      this.filteredHistory = this.history.filter(
        (h) => h.title.toLowerCase().includes(q) || h.url.toLowerCase().includes(q),
      );
    }
  }

  private formatDate(ts: number): string {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private emitRefreshHistory(): void {
    this.dispatchEvent(new CustomEvent('refresh-history', { bubbles: true, composed: true }));
  }

  private emitClearHistory(): void {
    this.dispatchEvent(new CustomEvent('clear-history', { bubbles: true, composed: true }));
  }

  private emitExportHistory(format: 'csv' | 'json'): void {
    this.dispatchEvent(
      new CustomEvent('export-history', {
        detail: { format },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
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
            @input=${(e: Event) => {
              this.historySearch = (e.target as HTMLInputElement).value;
            }}
          />
          <button class="btn btn-secondary" @click=${this.emitRefreshHistory} title="Reload history">
            Refresh
          </button>
          <button
            class="btn btn-secondary"
            @click=${() => this.emitExportHistory('csv')}
            title="Download history as CSV"
            ?disabled=${this.history.length === 0}
          >
            Export CSV
          </button>
          <button
            class="btn btn-secondary"
            @click=${() => this.emitExportHistory('json')}
            title="Download history as JSON"
            ?disabled=${this.history.length === 0}
          >
            Export JSON
          </button>
          <button class="btn btn-secondary btn-danger" @click=${this.emitClearHistory} title="Clear reading history">
            Clear History
          </button>
        </div>

        ${
          items.length > 0
            ? html`
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Source</th>
                      <th>Author</th>
                      <th class="col-width-date">Date Visited</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${items.map(
                      (item) => html`
                        <tr>
                          <td>
                            <a class="history-link" href=${item.url} target="_blank" rel="noopener noreferrer">
                              ${item.title || item.url}
                            </a>
                            <div class="source-url">${item.url}</div>
                          </td>
                          <td class="cell-nowrap text-secondary">${item.sourceName || '—'}</td>
                          <td class="cell-nowrap text-secondary">${item.author || '—'}</td>
                          <td class="cell-nowrap text-muted">${this.formatDate(item.fetchedAt)}</td>
                        </tr>
                      `,
                    )}
                  </tbody>
                </table>
              </div>
            `
            : html`
              <div class="empty-state">
                ${this.historySearch ? 'No matching history entries.' : 'No history yet. Click "Surprise Me" to get started.'}
              </div>
            `
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'history-section': HistorySection;
  }
}
