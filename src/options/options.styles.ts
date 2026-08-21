import { css } from 'lit';

export const optionsStyles = css`
  :host {
    /* ── Tokens (shared vocabulary with popup.styles) ───────── */
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
    --toggle-on: #0f766e;
    --toggle-knob: #ffffff;
    --success: #166534;
    --success-bg: #effaf3;
    --success-border: #cdeeda;
    --danger: #b91c1c;
    --danger-bg: #fdf1f1;
    --danger-border: #f5d4d4;
    --info: #1e40af;
    --info-bg: #eff4fd;
    --info-border: #d3e0f7;
    --shadow-sm: 0 1px 2px rgba(24, 20, 45, 0.05);
    --shadow-md: 0 2px 8px rgba(24, 20, 45, 0.07), 0 1px 2px rgba(24, 20, 45, 0.05);
    --shadow-lg: 0 12px 32px rgba(24, 20, 45, 0.14), 0 4px 12px rgba(24, 20, 45, 0.08);

    display: block;
    width: 100%;
    min-height: 100vh;
    padding: 0;
    font-family: var(--font);
    font-size: 13.5px;
    line-height: 1.5;
    color: var(--text-primary);
    background: var(--bg);
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

  /* Utility classes used by component templates */
  .pref-row-borderless {
    border-bottom: none !important;
    padding-bottom: 0 !important;
  }

  .text-danger {
    color: var(--danger) !important;
  }

  .text-muted {
    color: var(--text-muted) !important;
  }

  .text-secondary {
    color: var(--text-secondary) !important;
  }

  .mb-2 { margin-bottom: 8px !important; }
  .mb-3 { margin-bottom: 12px !important; }
  .mt-2 { margin-top: 8px !important; }
  .mt-3 { margin-top: 12px !important; }

  .col-width-on { width: 56px; }
  .col-width-date { width: 130px; }
  .cell-nowrap { white-space: nowrap; font-size: 12.5px; }

  /* ── Page layout ────────────────────────────────────────── */
  .page-shell {
    display: grid;
    grid-template-columns: 232px 1fr;
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
    border-radius: 9px;
    flex-shrink: 0;
  }

  .topbar-logo img {
    width: 32px;
    height: 32px;
    border-radius: 9px;
    display: block;
  }

  .topbar-title {
    font-size: 14.5px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  .topbar-sub {
    font-size: 12px;
    color: var(--text-muted);
    margin-left: 2px;
    padding-left: 10px;
    border-left: 1px solid var(--border);
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
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--text-muted);
    padding: 0 10px;
    margin-bottom: 8px;
    margin-top: 16px;
  }

  .sidebar-label:first-child {
    margin-top: 0;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    font-size: 13px;
    font-weight: 500;
    font-family: inherit;
    color: var(--text-secondary);
    background: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease-out, color 0.15s ease-out;
    margin-bottom: 2px;
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
    padding: 1px 7px;
    line-height: 1.5;
    min-width: 22px;
    text-align: center;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }

  .nav-item.active .nav-badge {
    background: var(--surface);
    border-color: color-mix(in srgb, var(--accent) 30%, transparent);
    color: var(--accent);
  }

  .nav-item:hover {
    background: var(--surface-alt);
    color: var(--text-primary);
  }

  .nav-item.active {
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 600;
  }

  .nav-item .nav-icon {
    font-size: 15px;
    width: 18px;
    height: 18px;
    text-align: center;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .nav-item .nav-icon svg {
    width: 100%;
    height: 100%;
  }

  /* Main content area */
  .main-content {
    grid-area: main;
    padding: 32px 40px 48px;
    overflow-y: auto;
  }

  /* ── Toast ──────────────────────────────────────────────── */
  .toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: min(90vw, 480px);
    padding: 11px 14px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 500;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-primary);
    animation: toast-in 0.24s cubic-bezier(0.2, 0, 0, 1);
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(10px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0) scale(1);
    }
  }

  .toast.success {
    background: var(--success-bg);
    border-color: var(--success-border);
    color: var(--success);
  }

  .toast.error {
    background: var(--danger-bg);
    border-color: var(--danger-border);
    color: var(--danger);
  }

  .toast.info {
    background: var(--info-bg);
    border-color: var(--info-border);
    color: var(--info);
  }

  .toast-message {
    flex: 1;
  }

  .toast-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: transparent;
    border: none;
    border-radius: 5px;
    color: inherit;
    cursor: pointer;
    opacity: 0.65;
    transition: opacity 0.15s ease-out, background 0.15s ease-out;
  }

  .toast-close .icon {
    width: 13px;
    height: 13px;
  }

  .toast-close:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.06);
  }

  /* ── Section heading ────────────────────────────────────── */
  .section-title {
    font-size: 19px;
    font-weight: 750;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .section-desc {
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 24px;
    line-height: 1.55;
    max-width: 640px;
  }

  /* ── Card ───────────────────────────────────────────────── */
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: var(--shadow-sm);
    margin-bottom: 16px;
    overflow: hidden;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 1px solid var(--border);
  }

  .card-title {
    font-size: 13.5px;
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
    padding: 20px;
  }

  /* ── Form fields ────────────────────────────────────────── */
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
    padding: 8px 12px;
    font-size: 13px;
    font-family: inherit;
    color: var(--text-primary);
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    outline: none;
    transition: border-color 0.15s ease-out, box-shadow 0.15s ease-out;
    -webkit-appearance: none;
    appearance: none;
  }

  select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238f8f87' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    padding-right: 32px;
    cursor: pointer;
  }

  input[type='text']:focus,
  input[type='url']:focus,
  input[type='number']:focus,
  select:focus {
    border-color: var(--ring);
    box-shadow: 0 0 0 3px var(--accent-soft);
    outline: none;
  }

  input[type='text']::placeholder,
  input[type='url']::placeholder {
    color: var(--text-muted);
  }

  /* ── Buttons ────────────────────────────────────────────── */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    border-radius: 8px;
    cursor: pointer;
    transition:
      background 0.15s ease-out,
      border-color 0.15s ease-out,
      box-shadow 0.15s ease-out,
      transform 0.15s ease-out;
    white-space: nowrap;
  }

  .btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn .icon {
    width: 13px;
    height: 13px;
  }

  .btn-primary {
    background: var(--accent);
    color: var(--accent-text);
    border: 1px solid var(--accent);
    box-shadow: 0 2px 8px rgba(15, 118, 110, 0.28);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(15, 118, 110, 0.34);
  }

  .btn-primary:active:not(:disabled) {
    transform: translateY(0);
  }

  .btn-secondary {
    background: var(--surface);
    color: var(--text-primary);
    border: 1px solid var(--border-strong);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--surface-alt);
    border-color: var(--text-muted);
  }

  .btn-danger {
    color: var(--danger);
    border-color: var(--danger-border);
    background: var(--danger-bg);
  }

  .btn-danger:hover:not(:disabled) {
    background: var(--danger-bg);
    border-color: var(--danger);
  }

  /* ── Reading stats ──────────────────────────────────────── */
  .stat-row {
    display: flex;
    gap: 32px;
    margin-bottom: 14px;
  }

  .stat-value {
    font-size: 26px;
    font-weight: 800;
    color: var(--text-primary);
    line-height: 1.1;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }

  .stat-label {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 3px;
  }

  .stat-list {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-width: 340px;
  }

  .stat-source {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 12.5px;
  }

  .stat-source-name {
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .stat-source-count {
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
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

  /* ── Dropzone ───────────────────────────────────────────── */
  .dropzone {
    border: 1.5px dashed var(--border-strong);
    border-radius: 12px;
    padding: 28px 20px;
    text-align: center;
    cursor: pointer;
    background: var(--bg);
    transition: border-color 0.15s ease-out, background 0.15s ease-out;
  }

  .dropzone:hover,
  .dropzone.dragover {
    border-color: var(--ring);
    background: var(--accent-soft);
  }

  .dz-icon {
    width: 28px;
    height: 28px;
    margin: 0 auto 10px;
    color: var(--accent);
    opacity: 0.85;
    display: block;
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

  /* ── Sources table ──────────────────────────────────────── */
  .sources-toolbar {
    display: flex;
    gap: 8px;
    padding: 12px 20px;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
  }

  .sources-toolbar input[type='text'],
  .sources-toolbar select {
    padding: 7px 11px;
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
    background: var(--bg);
    border-bottom: 1px solid var(--border);
  }

  th {
    padding: 9px 16px;
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-muted);
    text-align: left;
    white-space: nowrap;
  }

  tbody tr {
    border-bottom: 1px solid var(--border);
    transition: background 0.12s ease-out;
  }

  tbody tr:last-child {
    border-bottom: none;
  }

  tbody tr:hover {
    background: var(--bg);
  }

  tbody tr.disabled {
    opacity: 0.45;
  }

  td {
    padding: 11px 16px;
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
    font-weight: 600;
    font-size: 13px;
    border-radius: 3px;
  }

  .history-link:hover {
    text-decoration: underline;
    text-decoration-color: var(--ring);
    text-underline-offset: 2px;
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
    border-radius: 3px;
  }

  .clear-link:hover {
    color: var(--text-primary);
  }

  /* ── Toggle switch ──────────────────────────────────────── */
  .toggle-label {
    position: relative;
    display: inline-block;
    width: 38px;
    height: 22px;
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
    width: 38px;
    height: 22px;
    background: var(--border-strong);
    border-radius: 999px;
    transition: background 0.2s cubic-bezier(0.2, 0, 0, 1);
  }

  .toggle-track::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--toggle-knob, #ffffff);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1);
  }

  .toggle-label input:checked + .toggle-track {
    background: var(--toggle-on, var(--accent));
  }

  .toggle-label input:checked + .toggle-track::after {
    transform: translateX(16px);
  }

  .toggle-label input:focus-visible + .toggle-track {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }

  /* ── Badge ──────────────────────────────────────────────── */
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 5px;
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: var(--surface-alt);
    color: var(--text-secondary);
    border: 1px solid var(--border);
  }

  /* Snooze controls */
  .snooze-select {
    max-width: 110px;
    padding: 4px 26px 4px 9px;
    font-size: 12px;
    border-radius: 7px;
    border: 1px solid var(--border-strong);
    background: var(--surface);
    color: var(--text-primary);
  }

  .snooze-badge {
    display: inline-block;
    margin-right: 6px;
    padding: 2px 8px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 600;
    background: var(--accent-soft);
    color: var(--accent);
    border: 1px dashed color-mix(in srgb, var(--accent) 35%, transparent);
  }

  .btn-mini {
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 600;
    font-family: inherit;
    border-radius: 6px;
    cursor: pointer;
    background: var(--surface);
    color: var(--text-primary);
    border: 1px solid var(--border-strong);
    transition: background 0.15s ease-out, border-color 0.15s ease-out;
  }

  .btn-mini:hover {
    background: var(--surface-alt);
    border-color: var(--text-muted);
  }

  /* Empty state */
  .empty-state {
    text-align: center;
    padding: 36px 20px;
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
    padding: 5px 12px;
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    color: var(--text-secondary);
    background: var(--surface-alt);
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    cursor: pointer;
    user-select: none;
    transition: background 0.15s ease-out, border-color 0.15s ease-out, color 0.15s ease-out;
  }

  .tag-chip:hover {
    border-color: var(--text-muted);
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

  /* Blocked domains */
  .blocked-domain-input {
    display: flex;
    gap: 8px;
  }

  .blocked-domain-input input[type='text'] {
    flex: 1;
    min-width: 0;
    padding: 7px 11px;
    font-size: 12.5px;
  }

  .blocked-domain-chip {
    cursor: default;
    padding-right: 6px;
  }

  .blocked-domain-chip:hover {
    border-color: var(--border-strong);
    color: var(--text-secondary);
  }

  .chip-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    transition: color 0.15s ease-out, background 0.15s ease-out;
  }

  .chip-remove .icon {
    width: 10px;
    height: 10px;
  }

  .chip-remove:hover {
    color: var(--danger);
    background: var(--danger-bg);
  }

  /* Setting rows */
  .pref-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 13px 0;
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

  /* ── Onboarding ─────────────────────────────────────────── */
  .onboarding {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 32px 20px;
    background:
      radial-gradient(60% 50% at 50% 0%, var(--accent-soft) 0%, transparent 70%),
      var(--bg);
  }

  .onboard-card {
    width: 100%;
    max-width: 720px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    box-shadow: var(--shadow-lg);
    padding: 40px;
  }

  .onboard-hero {
    text-align: center;
    margin-bottom: 30px;
  }

  .onboard-logo {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    display: inline-block;
    margin-bottom: 16px;
    box-shadow: var(--shadow-md);
  }

  .onboard-hero h1 {
    font-size: 23px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .onboard-sub {
    font-size: 13.5px;
    color: var(--text-muted);
    line-height: 1.6;
    max-width: 440px;
    margin: 0 auto;
  }

  .onboard-section {
    margin-bottom: 24px;
  }

  .onboard-section-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--text-muted);
    margin-bottom: 12px;
  }

  .onboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(155px, 1fr));
    gap: 8px;
  }

  .interest-chip {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 10px 13px;
    font-size: 12.5px;
    font-weight: 500;
    font-family: inherit;
    color: var(--text-secondary);
    background: var(--surface-alt);
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    cursor: pointer;
    text-align: left;
    transition:
      background 0.15s ease-out,
      border-color 0.15s ease-out,
      color 0.15s ease-out,
      transform 0.15s ease-out;
    user-select: none;
  }

  .interest-chip:hover {
    border-color: var(--text-muted);
    color: var(--text-primary);
    transform: translateY(-1px);
  }

  .interest-chip.selected {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-text);
    box-shadow: 0 2px 8px rgba(15, 118, 110, 0.28);
  }

  .interest-icon {
    font-size: 15px;
    flex-shrink: 0;
  }

  .interest-label {
    flex: 1;
  }

  .interest-check {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    display: inline-flex;
  }

  .interest-check svg {
    width: 100%;
    height: 100%;
  }

  .onboard-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 20px;
    border-top: 1px solid var(--border);
  }

  .onboard-skip {
    background: none;
    border: none;
    padding: 6px 4px;
    font-size: 12.5px;
    font-family: inherit;
    color: var(--text-muted);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
    border-radius: 3px;
  }

  .onboard-skip:hover {
    color: var(--text-primary);
  }

  .onboard-start {
    min-width: 170px;
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
      --toggle-on: #0f766e;
      --toggle-knob: #ffffff;
      --success: #4ade80;
      --success-bg: rgba(74, 222, 128, 0.09);
      --success-border: rgba(74, 222, 128, 0.22);
      --danger: #f87171;
      --danger-bg: rgba(248, 113, 113, 0.09);
      --danger-border: rgba(248, 113, 113, 0.22);
      --info: #93b4f8;
      --info-bg: rgba(96, 165, 250, 0.09);
      --info-border: rgba(96, 165, 250, 0.22);
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
      --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.35), 0 1px 2px rgba(0, 0, 0, 0.3);
      --shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.35);
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
    --toggle-on: #0f766e;
    --toggle-knob: #ffffff;
    --success: #4ade80;
    --success-bg: rgba(74, 222, 128, 0.09);
    --success-border: rgba(74, 222, 128, 0.22);
    --danger: #f87171;
    --danger-bg: rgba(248, 113, 113, 0.09);
    --danger-border: rgba(248, 113, 113, 0.22);
    --info: #93b4f8;
    --info-bg: rgba(96, 165, 250, 0.09);
    --info-border: rgba(96, 165, 250, 0.22);
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
    --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.35), 0 1px 2px rgba(0, 0, 0, 0.3);
    --shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.35);
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
