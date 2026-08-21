import { css } from 'lit';

export const popupStyles = css`
  :host {
    /* ── Tokens ─────────────────────────────────────────────── */
    --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;

    /* Light theme: warm paper neutrals + teal brand accent */
    --bg: #f7f7f5;
    --surface: #ffffff;
    --surface-alt: #f1f1ee;
    --surface-hover: #e9e9e6;
    --border: #e5e5e1;
    --border-strong: #d3d3cd;
    --text-primary: #1b1b18;
    --text-secondary: #565650;
    --text-muted: #8f8f87;
    --accent: #0f766e;
    --accent-hover: #115e59;
    --accent-text: #ffffff;
    --accent-soft: rgba(15, 118, 110, 0.08);
    --grad-a: #0d9488;
    --grad-b: #115e59;
    --ring: #0d9488;
    --success-text: #166534;
    --success-bg: #effaf3;
    --success-border: #cdeeda;
    --error-text: #991b1b;
    --error-bg: #fdf1f1;
    --error-border: #f5d4d4;
    --shadow-sm: 0 1px 2px rgba(24, 20, 45, 0.05);
    --shadow-md: 0 2px 8px rgba(24, 20, 45, 0.07), 0 1px 2px rgba(24, 20, 45, 0.05);

    display: block;
    /* Extension popup: let height be natural, only constrain width */
    min-width: 340px;
    max-width: 420px;
    font-family: var(--font);
    font-size: 13px;
    line-height: 1.45;
    color: var(--text-primary);
    background: var(--bg);
    overflow: hidden;
    user-select: none;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
    border-radius: 4px;
  }

  .icon {
    display: inline-flex;
    flex-shrink: 0;
  }
  .icon svg {
    width: 100%;
    height: 100%;
  }

  /* ── Header ─────────────────────────────────────────────── */
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 11px 14px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .logo {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .logo img {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    display: block;
  }

  .title {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .subtitle {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 1px;
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.15s ease-out, border-color 0.15s ease-out, color 0.15s ease-out;
  }

  .icon-btn .icon {
    width: 15px;
    height: 15px;
  }

  .icon-btn:hover:not(:disabled) {
    background: var(--surface-alt);
    border-color: var(--border-strong);
    color: var(--text-primary);
  }

  .icon-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ── Content ────────────────────────────────────────────── */
  .content {
    padding: 14px;
  }

  /* Hero action. The entire extension exists to serve this button. */
  .roll-btn {
    width: 100%;
    height: 44px;
    padding: 0 16px;
    border: none;
    border-radius: 11px;
    background: linear-gradient(135deg, var(--grad-a), var(--grad-b));
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    font-family: inherit;
    letter-spacing: -0.01em;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow:
      0 4px 14px rgba(15, 118, 110, 0.32),
      inset 0 1px 0 rgba(255, 255, 255, 0.18);
    transition:
      transform 0.15s ease-out,
      box-shadow 0.15s ease-out,
      filter 0.15s ease-out;
    margin-bottom: 12px;
  }

  .roll-btn .icon {
    width: 18px;
    height: 18px;
  }

  .roll-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    filter: brightness(1.06);
    box-shadow:
      0 6px 18px rgba(15, 118, 110, 0.38),
      inset 0 1px 0 rgba(255, 255, 255, 0.18);
  }

  .roll-btn:active:not(:disabled) {
    transform: translateY(0);
    filter: brightness(0.98);
  }

  .roll-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    box-shadow: none;
  }

  /* Segmented control tabs */
  .tab-nav {
    display: flex;
    gap: 2px;
    padding: 3px;
    background: var(--surface-alt);
    border-radius: 9px;
    margin-bottom: 12px;
  }

  .tab-btn {
    flex: 1;
    padding: 6px 8px;
    font-size: 12px;
    font-weight: 600;
    font-family: inherit;
    color: var(--text-muted);
    background: transparent;
    border: none;
    border-radius: 7px;
    cursor: pointer;
    transition: color 0.15s ease-out, background 0.15s ease-out, box-shadow 0.15s ease-out;
  }

  .tab-btn:hover {
    color: var(--text-secondary);
  }

  .tab-btn.active {
    color: var(--text-primary);
    background: var(--surface);
    box-shadow: var(--shadow-sm);
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .panel-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 2px 6px;
  }

  .panel-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .btn-mini {
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 4px 9px;
    cursor: pointer;
    transition: border-color 0.15s ease-out, color 0.15s ease-out, background 0.15s ease-out;
  }

  .btn-mini:hover {
    border-color: var(--border-strong);
    background: var(--surface);
    color: var(--text-primary);
  }

  /* Setting cards */
  .opt-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow-sm);
    gap: 8px;
  }

  .opt-label {
    font-size: 12.5px;
    font-weight: 500;
    color: var(--text-primary);
    flex: 1;
    white-space: nowrap;
  }

  .opt-select {
    font-size: 12px;
    font-family: inherit;
    font-weight: 500;
    color: var(--text-primary);
    background-color: var(--bg);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%238f8f87' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    border: 1px solid var(--border);
    border-radius: 7px;
    padding: 5px 24px 5px 9px;
    cursor: pointer;
    min-width: 118px;
    max-width: 170px;
    appearance: none;
    -webkit-appearance: none;
    transition: border-color 0.15s ease-out, background-color 0.15s ease-out;
  }

  .opt-select:hover {
    border-color: var(--border-strong);
  }

  .opt-select:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 1px;
  }

  /* History tab */
  .history-list {
    list-style: none;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .history-item {
    padding: 9px 12px;
    border-bottom: 1px solid var(--border);
    font-size: 12px;
    transition: background 0.12s ease-out;
  }

  .history-item:hover {
    background: var(--bg);
  }

  .history-item:last-child {
    border-bottom: none;
  }

  .history-link {
    color: var(--text-primary);
    text-decoration: none;
    font-weight: 600;
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.4;
    border-radius: 3px;
  }

  .history-link:hover {
    text-decoration: underline;
    color: var(--accent);
  }

  .history-meta {
    font-size: 10.5px;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .empty-state {
    text-align: center;
    padding: 22px 12px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .empty-state .icon {
    width: 26px;
    height: 26px;
    margin: 0 auto 8px;
    opacity: 0.45;
    display: block;
  }

  /* Status pill */
  .status-pill {
    margin-top: 10px;
    padding: 8px 11px;
    border-radius: 9px;
    font-size: 12px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 7px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-secondary);
    animation: pill-in 0.22s cubic-bezier(0.2, 0, 0, 1);
  }

  @keyframes pill-in {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .status-pill.success {
    background: var(--success-bg);
    border-color: var(--success-border);
    color: var(--success-text);
  }

  .status-pill.error {
    background: var(--error-bg);
    border-color: var(--error-border);
    color: var(--error-text);
  }

  /* Onboarding banner */
  .onboard-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin: 10px 12px 0;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--accent-soft);
    border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
  }

  .onboard-banner-text {
    display: flex;
    flex-direction: column;
    font-size: 11.5px;
    color: var(--text-secondary);
    line-height: 1.35;
  }

  .onboard-banner-text strong {
    font-size: 12px;
    color: var(--text-primary);
    font-weight: 700;
  }

  .onboard-banner-btn {
    flex-shrink: 0;
    padding: 5px 11px;
    font-size: 11.5px;
    font-weight: 700;
    font-family: inherit;
    color: var(--accent-text);
    background: var(--accent);
    border: none;
    border-radius: 7px;
    cursor: pointer;
    transition: background 0.15s ease-out;
  }

  .onboard-banner-btn:hover {
    background: var(--accent-hover);
  }

  /* Footer */
  footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 8px 14px;
    background: var(--surface);
    border-top: 1px solid var(--border);
  }

  .footer-link {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 11.5px;
    font-family: inherit;
    cursor: pointer;
    padding: 2px 0;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    transition: color 0.15s ease-out;
    border-radius: 3px;
  }

  .footer-link:hover {
    color: var(--accent);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  /* Spinner */
  .spinner {
    width: 12px;
    height: 12px;
    border: 2px solid color-mix(in srgb, currentColor 25%, transparent);
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    display: inline-block;
    flex-shrink: 0;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ── Dark theme ─────────────────────────────────────────── */
  @media (prefers-color-scheme: dark) {
    :host([data-theme='system']) {
      --bg: #131315;
      --surface: #1b1b1f;
      --surface-alt: #242429;
      --surface-hover: #2d2d33;
      --border: #2a2a30;
      --border-strong: #3e3e46;
      --text-primary: #ececf1;
      --text-secondary: #a6a6b0;
      --text-muted: #70707a;
      --accent: #0f766e;
      --accent-hover: #0d9488;
      --accent-text: #ffffff;
      --accent-soft: rgba(20, 184, 166, 0.12);
      --grad-a: #14b8a6;
      --grad-b: #0d9488;
      --ring: #2dd4bf;
      --success-text: #4ade80;
      --success-bg: rgba(74, 222, 128, 0.09);
      --success-border: rgba(74, 222, 128, 0.22);
      --error-text: #f87171;
      --error-bg: rgba(248, 113, 113, 0.09);
      --error-border: rgba(248, 113, 113, 0.22);
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
      --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.35), 0 1px 2px rgba(0, 0, 0, 0.3);
    }
  }

  :host([data-theme='dark']) {
    --bg: #131315;
    --surface: #1b1b1f;
    --surface-alt: #242429;
    --surface-hover: #2d2d33;
    --border: #2a2a30;
    --border-strong: #3e3e46;
    --text-primary: #ececf1;
    --text-secondary: #a6a6b0;
    --text-muted: #70707a;
    --accent: #0f766e;
    --accent-hover: #0d9488;
    --accent-text: #ffffff;
    --accent-soft: rgba(20, 184, 166, 0.12);
    --grad-a: #14b8a6;
    --grad-b: #0d9488;
    --ring: #2dd4bf;
    --success-text: #4ade80;
    --success-bg: rgba(74, 222, 128, 0.09);
    --success-border: rgba(74, 222, 128, 0.22);
    --error-text: #f87171;
    --error-bg: rgba(248, 113, 113, 0.09);
    --error-border: rgba(248, 113, 113, 0.22);
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
    --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.35), 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  /* ── Reduced motion ─────────────────────────────────────── */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;
