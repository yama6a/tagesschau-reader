export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    node.setAttribute(name, value);
  }
  node.append(...children);
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

// A 24 x 24 stroked icon from one path.
export function icon(path: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', path);
  svg.append(p);
  return svg;
}

export const ICON_CHECK = 'M5 12.5l4.5 4.5L19 7.5';
export const ICON_UNDO = 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11';
export const ICON_CLOSE = 'M6 6l12 12M18 6L6 18';
export const ICON_SETTINGS = 'M4 7h10M18 7h2M4 17h2M10 17h10M16 4.5v5M8 14.5v5';

const DATE_FORMAT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Berlin',
});

// "08.11.2026, 09:27 Uhr"
export function formatDate(iso: string): string {
  return `${DATE_FORMAT.format(new Date(iso))} Uhr`;
}

const ROW_DATE_FORMAT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Europe/Berlin',
});

// "08.11. 09:12"
export function formatRowDate(iso: string): string {
  const part = (type: string) =>
    ROW_DATE_FORMAT.formatToParts(new Date(iso)).find((p) => p.type === type)?.value;
  return `${part('day')}.${part('month')}. ${part('hour')}:${part('minute')}`;
}
