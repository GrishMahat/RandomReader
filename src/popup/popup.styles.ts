import { css } from 'lit';

export const popupStyles = css`
  :host {
    --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;

    /* Light theme */
    --bg: #ffffff;
    --surface: #f5f5f5;
    --surface-hover: #ebebeb;
    --border: #d4d4d4;
    --text-primary: #171717;
    --text-secondary: #525252;
    --text-muted: #a3a3a3;
    --accent: #171717;
    --accent-hover: #000000;
    --accent-text: #ffffff;
    --success-text: #166534;
    --success-bg: #f0fdf4;
    --error-text: #991b1b;
    --error-bg: #fef2f2;

    display: block;
    /* Extension popup: let height be natural, only constrain width */
    min-width: 340px;
    max-width: 420px;
    font-family: var(--font);
    font-size: 13px;
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

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .logo {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .logo img {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    display: block;
  }

  .title {
    font-size: 13px;
    font-weight: 600;
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
    width: 26px;
    height: 26px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--bg);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 15px;
    line-height: 1;
    transition: background 0.1s, border-color 0.1s;
  }

  .icon-btn:hover:not(:disabled) {
    background: var(--surface-hover);
    border-color: #b5b5b5;
  }

  .icon-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .content {
    padding: 12px 14px;
  }

  .roll-btn {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--accent);
    border-radius: 5px;
    background: var(--accent);
    color: var(--accent-text);
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: background 0.1s, border-color 0.1s;
    margin-bottom: 10px;
    letter-spacing: -0.01em;
  }

  .roll-btn:hover:not(:disabled) {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
  }

  .roll-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .tab-nav {
    display: flex;
    border-bottom: 1px solid var(--border);
    margin-bottom: 10px;
    gap: 0;
  }

  .tab-btn {
    flex: 1;
    padding: 6px 8px;
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    color: var(--text-muted);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: color 0.1s, border-color 0.1s;
    margin-bottom: -1px;
  }

  .tab-btn:hover {
    color: var(--text-secondary);
  }

  .tab-btn.active {
    color: var(--text-primary);
    border-bottom-color: var(--accent);
    font-weight: 600;
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: 6px;
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
    font-weight: 500;
    color: var(--text-secondary);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 3px 8px;
    cursor: pointer;
    transition: border-color 0.1s, color 0.1s;
  }

  .btn-mini:hover {
    border-color: var(--accent);
    color: var(--text-primary);
  }

  .opt-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 5px;
    gap: 8px;
  }

  .opt-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-primary);
    flex: 1;
    white-space: nowrap;
  }

  .opt-select {
    font-size: 12px;
    font-family: inherit;
    color: var(--text-primary);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 3px 6px;
    cursor: pointer;
    min-width: 110px;
    max-width: 170px;
  }

  .opt-select:focus {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  /* History tab */
  .history-list {
    list-style: none;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--surface);
    overflow: hidden;
  }

  .history-item {
    padding: 7px 10px;
    border-bottom: 1px solid var(--border);
    font-size: 12px;
  }

  .history-item:last-child {
    border-bottom: none;
  }

  .history-link {
    color: var(--text-primary);
    text-decoration: none;
    font-weight: 500;
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.4;
  }

  .history-link:hover {
    text-decoration: underline;
    color: var(--accent);
  }

  .history-meta {
    font-size: 10.5px;
    color: var(--text-muted);
    margin-top: 1px;
  }

  .empty-state {
    text-align: center;
    padding: 20px 12px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .status-pill {
    margin-top: 8px;
    padding: 7px 10px;
    border-radius: 5px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-secondary);
  }

  .onboard-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin: 10px 12px 0;
    padding: 9px 12px;
    border-radius: 6px;
    background: var(--surface);
    border: 1px solid var(--border);
  }

  .onboard-banner-text {
    display: flex;
    flex-direction: column;
    font-size: 11.5px;
    color: var(--text-muted);
    line-height: 1.35;
  }

  .onboard-banner-text strong {
    font-size: 12px;
    color: var(--text-primary);
    font-weight: 600;
  }

  .onboard-banner-btn {
    flex-shrink: 0;
    padding: 4px 10px;
    font-size: 11.5px;
    font-weight: 600;
    font-family: inherit;
    color: #fff;
    background: var(--accent, #171717);
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .status-pill.success {
    background: var(--success-bg);
    border-color: #bbf7d0;
    color: var(--success-text);
  }

  .status-pill.error {
    background: var(--error-bg);
    border-color: #fecaca;
    color: var(--error-text);
  }

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
    padding: 0;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    transition: color 0.1s;
  }

  .footer-link:hover {
    color: var(--text-primary);
    text-decoration: underline;
  }

  .spinner {
    width: 11px;
    height: 11px;
    border: 2px solid var(--border);
    border-top-color: var(--text-secondary);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    display: inline-block;
    flex-shrink: 0;
  }

  .roll-btn .spinner {
    border-color: rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (prefers-color-scheme: dark) {
    :host([data-theme='system']) {
      --bg: #1a1a1a;
      --surface: #242424;
      --surface-hover: #2e2e2e;
      --border: #3a3a3a;
      --text-primary: #e5e5e5;
      --text-secondary: #a3a3a3;
      --text-muted: #6b6b6b;
      --accent: #e5e5e5;
      --accent-hover: #ffffff;
      --accent-text: #1a1a1a;
      --success-text: #4ade80;
      --success-bg: rgba(74, 222, 128, 0.08);
      --error-text: #f87171;
      --error-bg: rgba(248, 113, 113, 0.08);
    }
  }

  :host([data-theme='dark']) {
    --bg: #1a1a1a;
    --surface: #242424;
    --surface-hover: #2e2e2e;
    --border: #3a3a3a;
    --text-primary: #e5e5e5;
    --text-secondary: #a3a3a3;
    --text-muted: #6b6b6b;
    --accent: #e5e5e5;
    --accent-hover: #ffffff;
    --accent-text: #1a1a1a;
    --success-text: #4ade80;
    --success-bg: rgba(74, 222, 128, 0.08);
    --error-text: #f87171;
    --error-bg: rgba(248, 113, 113, 0.08);
  }
`;
