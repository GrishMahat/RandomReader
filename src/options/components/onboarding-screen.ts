import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { InterestGroup } from '../../config/interests';
import { optionsStyles } from '../options.styles';

@customElement('onboarding-screen')
export class OnboardingScreen extends LitElement {
  static styles = optionsStyles;

  @property({ type: Array }) groups: InterestGroup[] = [];
  @property({ type: Boolean }) saving = false;

  @state() private selectedInterests: string[] = [];

  private toggleInterest(label: string): void {
    if (this.selectedInterests.includes(label)) {
      this.selectedInterests = this.selectedInterests.filter((l) => l !== label);
    } else {
      this.selectedInterests = [...this.selectedInterests, label];
    }
  }

  private emitFinish(): void {
    this.dispatchEvent(
      new CustomEvent('finish-onboarding', {
        detail: { selectedInterests: this.selectedInterests },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private emitSkip(): void {
    this.dispatchEvent(new CustomEvent('skip-onboarding', { bubbles: true, composed: true }));
  }

  render() {
    const selectedCount = this.selectedInterests.length;

    return html`
      <div class="onboarding">
        <div class="onboard-card">
          <div class="onboard-hero">
            <img src=${new URL('../../icons/icon-32.png', import.meta.url).href} alt="" width="56" height="56" class="onboard-logo" />
            <h1>Welcome to Random Reader</h1>
            <p class="onboard-sub">Pick what you're into and we'll roll articles from those topics. You can change this anytime in Settings.</p>
          </div>

          <div class="onboard-section">
            <div class="onboard-section-label">Your Interests</div>
            ${
              this.groups.length > 0
                ? html`
                  <div class="onboard-grid">
                    ${this.groups.map((group) => {
                      const active = this.selectedInterests.includes(group.label);
                      return html`
                        <button class="interest-chip ${active ? 'selected' : ''}" @click=${() => this.toggleInterest(group.label)}>
                          <span class="interest-icon">${group.icon}</span>
                          <span class="interest-label">${group.label}</span>
                          ${active ? html`<span class="interest-check">✓</span>` : ''}
                        </button>
                      `;
                    })}
                  </div>
                `
                : html`<div class="empty-state">No catalog loaded yet. Feeds are refreshing — you can pick interests after sources are ready.</div>`
            }
          </div>

          <div class="onboard-footer">
            <button class="onboard-skip" @click=${this.emitSkip}>Skip for now</button>
            <button class="btn btn-primary onboard-start" @click=${this.emitFinish} ?disabled=${this.groups.length === 0 || this.saving}>
              ${
                this.saving
                  ? html`<span class="spinner"></span> Saving...`
                  : selectedCount > 0
                    ? `Start Reading (${selectedCount} selected)`
                    : 'Start Reading'
              }
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'onboarding-screen': OnboardingScreen;
  }
}
