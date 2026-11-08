import { el, formatRowDate, icon, ICON_CHECK, ICON_UNDO } from './dom';
import type { Story } from './feed';
import type { RowMode } from './readState';

export interface Entry {
  story: Story;
  mode: RowMode;
}

// Rows are kept by sophoraId, so a new render moves existing rows and their images stay loaded.
// A row is built again when a refresh changes its text or its breaking news flag.
const rows = new Map<string, HTMLElement>();
// Rows whose title size is not set for the current width yet.
const unfitted = new Set<HTMLElement>();

// Title font size as a share of the normal size, from largest to smallest.
export const FIT_STEPS = [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7];

// Lowers the title size until the text fits in the row. If 70% is still too big, the row grows.
export function fitTitle(row: HTMLElement): void {
  const body = row.querySelector<HTMLElement>('.body');
  if (!body || body.clientHeight === 0) {
    return;
  }
  delete row.dataset.grow;
  for (const step of FIT_STEPS) {
    row.style.setProperty('--fit', String(step));
    if (body.scrollHeight <= body.clientHeight) {
      return;
    }
  }
  row.dataset.grow = '';
}

function fitRows(rowsToFit: Iterable<HTMLElement>): void {
  for (const row of rowsToFit) {
    if (row.isConnected && row.dataset.mode !== 'collapsed') {
      fitTitle(row);
    }
  }
}

// Fits every row again when the list width changes or fonts finish loading.
export function observeFit(container: HTMLElement): void {
  let width = container.clientWidth;
  new ResizeObserver(() => {
    if (container.clientWidth !== width) {
      width = container.clientWidth;
      fitRows(rows.values());
    }
  }).observe(container);
  void document.fonts?.ready.then(() => fitRows(rows.values()));
}

function buildRow(story: Story): HTMLElement {
  const variants = story.teaserImage?.imageVariants;
  const thumb = el('div', { class: 'thumb' });
  if (variants?.['1x1-256']) {
    const img = el('img', {
      src: variants['1x1-256'],
      alt: story.teaserImage?.alttext ?? '',
      loading: 'lazy',
      sizes: '34vw',
    });
    if (variants['1x1-432']) {
      img.srcset = `${variants['1x1-256']} 256w, ${variants['1x1-432']} 432w`;
    }
    thumb.append(img);
  }

  const body = el(
    'div',
    { class: 'body' },
    el('button', { class: 'mark', type: 'button', 'data-action': 'toggle' }),
  );
  if (story.breakingNews) {
    body.append(el('span', { class: 'breaking' }, 'Eilmeldung'));
  }
  if (story.topline) {
    body.append(el('p', { class: 'topline' }, story.topline));
  }
  const href = story.detailsweb ?? story.shareURL ?? '#';
  body.append(
    el('h3', { class: 'title' }, el('a', { href, 'data-action': 'open' }, story.title)),
    el('button', { class: 'show', type: 'button', 'data-action': 'toggle' }, 'Anzeigen'),
  );

  return el(
    'article',
    { class: 'row', 'data-id': story.sophoraId },
    thumb,
    el('time', { class: 'date', datetime: story.date }, formatRowDate(story.date)),
    body,
  );
}

function updateRow(row: HTMLElement, mode: RowMode): void {
  if (row.dataset.mode === mode) {
    return;
  }
  const before = row.dataset.mode;
  if (mode !== 'collapsed' && (before === undefined || before === 'collapsed')) {
    unfitted.add(row);
  }
  row.dataset.mode = mode;
  const mark = row.querySelector<HTMLButtonElement>('.mark');
  if (!mark) {
    return;
  }
  const read = mode !== 'unread';
  mark.setAttribute('aria-label', read ? 'Als ungelesen markieren' : 'Als gelesen markieren');
  mark.replaceChildren(icon(read ? ICON_UNDO : ICON_CHECK));
}

export function renderRows(container: HTMLElement, entries: Entry[]): void {
  const wanted: HTMLElement[] = [];
  for (const { story, mode } of entries) {
    if (mode === 'hidden') {
      continue;
    }
    const sig = `${story.breakingNews}|${story.topline}|${story.title}`;
    let row = rows.get(story.sophoraId);
    if (row?.dataset.sig !== sig) {
      row = buildRow(story);
      row.dataset.sig = sig;
      rows.set(story.sophoraId, row);
      unfitted.add(row);
    }
    updateRow(row, mode);
    wanted.push(row);
  }

  // Move only the rows whose place changed, so the browser keeps the scroll position steady.
  let cursor = container.firstElementChild;
  for (const row of wanted) {
    if (row === cursor) {
      cursor = cursor.nextElementSibling;
    } else {
      container.insertBefore(row, cursor);
    }
  }
  while (cursor) {
    const next = cursor.nextElementSibling;
    cursor.remove();
    cursor = next;
  }

  // Fit after the rows are in the page, because fitting reads their size.
  fitRows(unfitted);
  unfitted.clear();
}

export function clearRows(container: HTMLElement): void {
  rows.clear();
  unfitted.clear();
  container.replaceChildren();
}
