import { fetchJson, type ArdItem, type Article } from './api';
import { figure, renderContent } from './content';
import { el, formatDate, icon, ICON_CLOSE } from './dom';
import type { Story } from './feed';
import { failure } from './status';
import { itemUrl, playable, type Video } from './videos';

let dialog: HTMLDialogElement;
let header: HTMLElement;
let body: HTMLElement;
let footer: HTMLElement;
let shown: Story | Video | undefined;

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
      // Removing a video from the page stops it.
      header.replaceChildren();
      body.replaceChildren();
    }
  });
  body.addEventListener('click', openLinkedArticle);
}

function show(id: string, top: Node[], link?: { href: string; label: string }): void {
  header.replaceChildren(...top);
  footer.replaceChildren(
    ...(link
      ? [el('a', { href: link.href, target: '_blank', rel: 'noopener noreferrer' }, link.label)]
      : []),
  );
  dialog.showModal();
  dialog.scrollTop = 0;
  history.pushState({ article: id }, '');
}

// Shows `build`'s nodes in the body, unless the dialog has moved on to another item meanwhile.
async function fill(item: Story | Video, build: () => Promise<Node[]>): Promise<void> {
  body.replaceChildren(el('p', { class: 'loading' }, 'Wird geladen'));
  try {
    const nodes = await build();
    if (shown === item) {
      body.replaceChildren(...nodes);
    }
  } catch {
    if (shown === item) {
      body.replaceChildren(failure(() => void fill(item, build)));
    }
  }
}

export function openArticle(story: Story): void {
  shown = story;
  const teaser = story.teaserImage && figure(story.teaserImage);
  const web = story.shareURL ?? story.detailsweb;
  show(
    story.sophoraId,
    [
      ...(teaser ? [teaser] : []),
      ...(story.topline ? [el('p', { class: 'topline' }, story.topline)] : []),
      el('h2', {}, story.title),
      el('p', { class: 'date' }, formatDate(story.date)),
    ],
    web ? { href: web, label: 'Auf tagesschau.de lesen' } : undefined,
  );
  void fill(story, async () => {
    if (!story.details) {
      throw new Error(`${story.sophoraId} has no details URL`);
    }
    const article = await fetchJson<Article>(story.details);
    return [renderContent(article.content ?? [], story.teaserImage)];
  });
}

// The player shows at once with the poster. Its sources and the topics arrive with the item JSON.
export function openVideo(video: Video, onPlay: () => void): void {
  shown = video;
  const player = el('video', { controls: '', preload: 'none', playsinline: '' });
  if (video.poster) {
    player.poster = video.poster;
  }
  player.addEventListener('play', onPlay, { once: true });
  show(video.sophoraId, [el('figure', {}, player), el('h2', {}, video.title)], {
    href: video.detailsweb,
    label: 'In der ARD Mediathek ansehen',
  });
  void fill(video, async () => {
    const item = await fetchJson<ArdItem>(itemUrl(video.sophoraId));
    const sources = playable(item);
    if (sources.length === 0) {
      throw new Error(`${video.sophoraId} has no stream`);
    }
    player.replaceChildren(...sources.map((m) => el('source', { src: m.url, type: m.mimeType })));
    const topics = item.widgets[0]?.synopsis;
    return topics ? [el('p', { class: 'synopsis' }, topics)] : [];
  });
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
