import { el, icon, ICON_CHECK, ICON_UNDO } from './dom';
import type { Story } from './feed';
import type { RowMode } from './readState';

export interface Entry {
  story: Story;
  mode: RowMode;
}

// Rows are kept by sophoraId, so a new render moves existing rows and their images stay loaded.
// A row is built again when a refresh changes its text or its breaking news flag.
const rows = new Map<string, HTMLElement>();

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

  return el('article', { class: 'row', 'data-id': story.sophoraId }, thumb, body);
}

function updateRow(row: HTMLElement, mode: RowMode): void {
  if (row.dataset.mode === mode) {
    return;
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
}

export function clearRows(container: HTMLElement): void {
  rows.clear();
  container.replaceChildren();
}
