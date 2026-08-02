import { css } from 'lit';

export const optionsStyles = css`
  :host {
    --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;

    /* Light neutral palette */
    --bg: #fafafa;
    --surface: #ffffff;
    --surface-alt: #f5f5f5;
    --border: #e5e5e5;
    --border-strong: #d4d4d4;
    --text-primary: #171717;
    --text-secondary: #525252;
    --text-muted: #a3a3a3;
    --accent: #171717;
    --accent-text: #ffffff;
    --accent-soft: rgba(23, 23, 23, 0.06);
    --success: #166534;
    --success-bg: #f0fdf4;
    --success-border: #bbf7d0;
    --danger: #991b1b;
    --danger-bg: #fef2f2;
    --danger-border: #fecaca;
    --info: #1e3a8a;
    --info-bg: #eff6ff;
    --info-border: #bfdbfe;

    display: block;
    /* Full width desktop layout */
    width: 100%;
    min-height: 100vh;
    padding: 0;
    font-family: var(--font);
    font-size: 13px;
    color: var(--text-primary);
    background: var(--bg);
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  /* Page layout */
  .page-shell {
    display: grid;
    grid-template-columns: 220px 1fr;
    grid-template-rows: 56px 1fr;
    grid-template-areas:
      "topbar topbar"
      "sidebar main";
    min-height: 100vh;
  }

  /* Top bar */
  .topbar {
    grid-area: topbar;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 24px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .topbar-logo {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    flex-shrink: 0;
  }

  .topbar-logo img {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: block;
  }

  .topbar-title {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  .topbar-sub {
    font-size: 12px;
    color: var(--text-muted);
    margin-left: 4px;
  }

  /* Sidebar nav */
  .sidebar {
    grid-area: sidebar;
    background: var(--surface);
    border-right: 1px solid var(--border);
    padding: 16px 12px;
    position: sticky;
    top: 56px;
    height: calc(100vh - 56px);
    overflow-y: auto;
  }

  .sidebar-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    padding: 0 8px;
    margin-bottom: 6px;
    margin-top: 16px;
  }

  .sidebar-label:first-child {
    margin-top: 0;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 8px;
    font-size: 13px;
    font-weight: 500;
    font-family: inherit;
    color: var(--text-secondary);
    background: transparent;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s, color 0.1s;
    margin-bottom: 1px;
  }

  .nav-label {
    flex: 1;
  }

  .nav-badge {
    font-size: 10.5px;
    font-weight: 600;
    color: var(--text-muted);
    background: var(--surface-alt);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 1px 6px;
    line-height: 1.5;
    min-width: 20px;
    text-align: center;
    flex-shrink: 0;
  }

  .nav-item.active .nav-badge {
    background: var(--accent-soft);
    border-color: var(--border-strong);
  }

  .nav-item:hover {
    background: var(--surface-alt);
    color: var(--text-primary);
  }

  .nav-item.active {
    background: var(--accent-soft);
    color: var(--text-primary);
    font-weight: 600;
  }

  .nav-item .nav-icon {
    font-size: 14px;
    width: 18px;
    text-align: center;
    flex-shrink: 0;
  }

  /* Main content area */
  .main-content {
    grid-area: main;
    padding: 28px 32px;
    overflow-y: auto;
  }

  /* Status banner */
  .status-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 20px;
    border: 1px solid var(--border);
    background: var(--surface-alt);
    color: var(--text-secondary);
  }

  .status-banner.success {
    background: var(--success-bg);
    border-color: var(--success-border);
    color: var(--success);
  }

  .status-banner.error {
    background: var(--danger-bg);
    border-color: var(--danger-border);
    color: var(--danger);
  }

  .status-banner.info {
    background: var(--info-bg);
    border-color: var(--info-border);
    color: var(--info);
  }

  /* Section heading */
  .section-title {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .section-desc {
    font-size: 12.5px;
    color: var(--text-muted);
    margin-bottom: 20px;
    line-height: 1.5;
  }

  /* Card */
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-bottom: 16px;
    overflow: hidden;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid var(--border);
    background: var(--surface-alt);
  }

  .card-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .card-hint {
    font-size: 12px;
    font-weight: 400;
    color: var(--text-muted);
  }

  .card-body {
    padding: 18px;
  }

  /* Form fields */
  .field {
    margin-bottom: 16px;
  }

  .field:last-child {
    margin-bottom: 0;
  }

  .field > label {
    display: block;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 6px;
  }

  .help-text {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 5px;
    line-height: 1.5;
  }

  input[type='text'],
  input[type='url'],
  input[type='number'],
  select {
    width: 100%;
    padding: 8px 11px;
    font-size: 13px;
    font-family: inherit;
    color: var(--text-primary);
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 5px;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    -webkit-appearance: none;
    appearance: none;
  }

  select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23737373' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    padding-right: 30px;
  }

  input[type='text']:focus,
  input[type='url']:focus,
  input[type='number']:focus,
  select:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-soft);
  }

  input[type='text']::placeholder,
  input[type='url']::placeholder {
    color: var(--text-muted);
  }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    border-radius: 5px;
    cursor: pointer;
    transition: background 0.1s, border-color 0.1s;
    white-space: nowrap;
  }

  .btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--accent);
    color: var(--accent-text);
    border: 1px solid var(--accent);
  }

  .btn-primary:hover:not(:disabled) {
    background: #000;
    border-color: #000;
  }

  .btn-secondary {
    background: var(--surface);
    color: var(--text-primary);
    border: 1px solid var(--border-strong);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--surface-alt);
    border-color: #b5b5b5;
  }

  .btn-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  /* Actions row */
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  /* Dropzone */
  .dropzone {
    border: 2px dashed var(--border-strong);
    border-radius: 7px;
    padding: 24px 20px;
    text-align: center;
    cursor: pointer;
    background: var(--bg);
    transition: border-color 0.15s, background 0.15s;
  }

  .dropzone:hover,
  .dropzone.dragover {
    border-color: var(--text-secondary);
    background: var(--surface-alt);
  }

  .dropzone .dz-title {
    font-weight: 600;
    font-size: 13.5px;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .dropzone .dz-sub {
    font-size: 12px;
    color: var(--text-muted);
  }

  .dropzone input[type='file'] {
    display: none;
  }

  /* Sources table */
  .sources-toolbar {
    display: flex;
    gap: 8px;
    padding: 12px 18px;
    background: var(--surface-alt);
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
  }

  .sources-toolbar input[type='text'],
  .sources-toolbar select {
    padding: 6px 10px;
    font-size: 12.5px;
  }

  .sources-toolbar input[type='text'] {
    flex: 2;
    min-width: 180px;
  }

  .sources-toolbar select {
    flex: 1;
    min-width: 130px;
    max-width: 200px;
  }

  .table-wrap {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  thead tr {
    background: var(--surface-alt);
    border-bottom: 1px solid var(--border);
  }

  th {
    padding: 9px 14px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    text-align: left;
    white-space: nowrap;
  }

  tbody tr {
    border-bottom: 1px solid var(--border);
    transition: background 0.1s;
  }

  tbody tr:last-child {
    border-bottom: none;
  }

  tbody tr:hover {
    background: var(--surface-alt);
  }

  tbody tr.disabled {
    opacity: 0.45;
  }

  td {
    padding: 10px 14px;
    vertical-align: middle;
  }

  .source-name {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 13px;
  }

  .source-url {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 420px;
  }

  .source-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding-top: 2px;
    padding-bottom: 2px;
  }

  .tag-pill {
    display: inline-block;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-secondary);
    background: var(--surface-alt);
    border: 1px solid var(--border);
    border-radius: 999px;
    white-space: nowrap;
  }

  .history-link {
    color: var(--text-primary);
    text-decoration: none;
    font-weight: 500;
    font-size: 13px;
  }

  .history-link:hover {
    text-decoration: underline;
  }

  .clear-link {
    background: none;
    border: none;
    padding: 0;
    font-size: 12px;
    font-family: inherit;
    color: var(--text-muted);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .clear-link:hover {
    color: var(--text-primary);
  }

  /* Toggle switch */
  .toggle-label {
    position: relative;
    display: inline-block;
    width: 34px;
    height: 19px;
    flex-shrink: 0;
    cursor: pointer;
  }

  .toggle-label input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }

  .toggle-track {
    position: absolute;
    top: 0;
    left: 0;
    width: 34px;
    height: 19px;
    background: var(--border-strong);
    border-radius: 999px;
    transition: background 0.2s;
  }

  .toggle-track::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .toggle-label input:checked + .toggle-track {
    background: var(--accent);
  }

  .toggle-label input:checked + .toggle-track::after {
    transform: translateX(15px);
  }

  /* Badge */
  .badge {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: var(--surface-alt);
    color: var(--text-secondary);
    border: 1px solid var(--border);
  }

  /* Empty state */
  .empty-state {
    text-align: center;
    padding: 32px 20px;
    color: var(--text-muted);
    font-size: 13px;
  }

  /* Tag chips */
  .tag-group {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 11px;
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    color: var(--text-secondary);
    background: var(--surface-alt);
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    cursor: pointer;
    user-select: none;
    transition: background 0.1s, border-color 0.1s, color 0.1s;
  }

  .tag-chip:hover {
    border-color: var(--text-secondary);
    color: var(--text-primary);
  }

  .tag-chip input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .tag-chip.selected {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-text);
  }

  .tag-chip.selected.danger {
    background: var(--danger);
    border-color: var(--danger);
    color: #fff;
  }

  /* Setting rows (key: value pairs in general preferences) */
  .pref-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
    gap: 16px;
  }

  .pref-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .pref-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    flex: 1;
  }

  .pref-desc {
    font-size: 11.5px;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .pref-control {
    flex-shrink: 0;
    min-width: 160px;
  }

  .pref-control select,
  .pref-control input {
    width: 100%;
  }

  /* Spinner */
  .spinner {
    width: 12px;
    height: 12px;
    border: 2px solid var(--border-strong);
    border-top-color: var(--text-secondary);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    display: inline-block;
    flex-shrink: 0;
  }

  .btn-primary .spinner {
    border-color: rgba(255,255,255,0.3);
    border-top-color: #fff;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (prefers-color-scheme: dark) {
    :host {
      --bg: #111111;
      --surface: #1a1a1a;
      --surface-alt: #222222;
      --border: #2e2e2e;
      --border-strong: #404040;
      --text-primary: #e5e5e5;
      --text-secondary: #a3a3a3;
      --text-muted: #6b6b6b;
      --accent: #e5e5e5;
      --accent-text: #111111;
      --accent-soft: rgba(229, 229, 229, 0.08);
      --success: #4ade80;
      --success-bg: rgba(74, 222, 128, 0.07);
      --success-border: rgba(74, 222, 128, 0.2);
      --danger: #f87171;
      --danger-bg: rgba(248, 113, 113, 0.07);
      --danger-border: rgba(248, 113, 113, 0.2);
      --info: #60a5fa;
      --info-bg: rgba(96, 165, 250, 0.07);
      --info-border: rgba(96, 165, 250, 0.2);
    }
  }
`;
