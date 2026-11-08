import { fetchJson, type Article } from './api';
import { renderContent } from './content';
import { el, formatDate, icon, ICON_CLOSE } from './dom';
import type { Story } from './feed';
import { failure } from './status';

let dialog: HTMLDialogElement;
let header: HTMLElement;
let body: HTMLElement;
let footer: HTMLElement;
let shown: Story | undefined;

export function initModal(node: HTMLDialogElement): void {
  dialog = node;
  const close = el('button', { class: 'close', type: 'button', 'aria-label': 'Schließen' });
  close.append(icon(ICON_CLOSE));
  header = el('header');
  body = el('div', { class: 'content' });
  footer = el('footer');
  dialog.append(close, el('article', {}, header, body, footer));

  // Every close goes through the history entry that opening pushed, so the back button, the swipe
  // back and the close button all end in the popstate handler below.
  close.addEventListener('click', () => history.back());
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    history.back();
  });
  window.addEventListener('popstate', () => {
    if (dialog.open) {
      shown = undefined;
      dialog.close();
      body.replaceChildren();
    }
  });
  body.addEventListener('click', openLinkedArticle);
}

export function openArticle(story: Story): void {
  shown = story;
  header.replaceChildren(
    ...(story.topline ? [el('p', { class: 'topline' }, story.topline)] : []),
    el('h2', {}, story.title),
    el('p', { class: 'date' }, formatDate(story.date)),
  );
  const web = story.shareURL ?? story.detailsweb;
  footer.replaceChildren(
    ...(web
      ? [
          el(
            'a',
            { href: web, target: '_blank', rel: 'noopener noreferrer' },
            'Auf tagesschau.de lesen',
          ),
        ]
      : []),
  );
  dialog.showModal();
  dialog.scrollTop = 0;
  history.pushState({ article: story.sophoraId }, '');
  void load(story);
}

async function load(story: Story): Promise<void> {
  body.replaceChildren(el('p', { class: 'loading' }, 'Wird geladen'));
  try {
    if (!story.details) {
      throw new Error(`${story.sophoraId} has no details URL`);
    }
    const article = await fetchJson<Article>(story.details);
    if (shown === story) {
      body.replaceChildren(renderContent(article.content ?? []));
    }
  } catch {
    if (shown === story) {
      body.replaceChildren(failure(() => void load(story)));
    }
  }
}

// A link to another article points at its JSON. The href holds a guess at the web page, which is
// wrong for articles on sportschau.de and the regional sites. The tab opens at once, so no popup
// blocker stops it, and moves on to the address the JSON names.
function openLinkedArticle(e: MouseEvent): void {
  const link = (e.target as Element).closest<HTMLAnchorElement>('a[data-api]');
  const api = link?.dataset.api;
  if (!link || !api) {
    return;
  }
  const tab = window.open('', '_blank');
  if (!tab) {
    return;
  }
  e.preventDefault();
  tab.opener = null;
  fetchJson<Article>(api)
    .then((a) => a.detailsweb ?? a.shareURL ?? link.href)
    .catch(() => link.href)
    .then((url) => tab.location.replace(url));
}
