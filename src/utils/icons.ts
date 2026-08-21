import { svg } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

/**
 * Inline SVG icon set (lucide-style: 24px grid, 1.75 stroke, round caps).
 * Vector-only per design rules: no emoji as structural icons.
 * Wrap in a sized container; the svg fills it via currentColor.
 */

const icon = (paths: string) => svg`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    ${unsafeSVG(paths)}
  </svg>
`;

export const iconSliders = icon(
  '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
);

export const iconBroadcast = icon(
  '<circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.25a6 6 0 0 1 0-8.49M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14"/>',
);

export const iconFilter = icon('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>');

export const iconClock = icon('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>');

export const iconPackage = icon(
  '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
);

export const iconDice = icon(
  '<rect x="3" y="3" width="18" height="18" rx="4.5"/><circle cx="8.5" cy="8.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="8.5" cy="15.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1.4" fill="currentColor" stroke="none"/>',
);

export const iconRefresh = icon('<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>');

export const iconX = icon('<path d="M18 6 6 18M6 6l12 12"/>');

export const iconCheck = icon('<polyline points="20 6 9 17 4 12"/>');

export const iconUpload = icon(
  '<path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
);

export const iconSearch = icon('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>');

export const iconDownload = icon(
  '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
);

export const iconTrash = icon(
  '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
);
