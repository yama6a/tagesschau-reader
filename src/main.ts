import './style.css';
import { fetchJson, type NewsPage } from './api';
import { byId, el, icon, ICON_SETTINGS, nearViewport } from './dom';
import {
  addPage,
  createFeed,
  cutoff,
  exhausted,
  listed,
  nextLoads,
  type Feed,
  type Story,
} from './feed';
import { clearRows, observeFit, renderRows } from './list';
import { initModal, openArticle } from './modal';
import { initOnboarding, openOnboarding } from './onboarding';
import {
  isRead,
  markAllRead,
  markRead,
  markUnread,
  olderMayShow,
  prune,
  rowMode,
} from './readState';
import type { Settings } from './settings';
import { failure } from './status';
import * as storage from './storage';
import { refreshVideos, showVideos } from './videoView';

const REFRESH_MS = 2 * 60 * 1000;

const list = byId<HTMLElement>('list');
const sentinel = byId<HTMLElement>('sentinel');
const status = byId<HTMLElement>('status');
const refreshStatus = byId<HTMLElement>('refresh-status');
const showReadToggle = byId<HTMLInputElement>('show-read');

const readState = storage.loadReadState();
prune(readState, Date.now());
storage.saveReadState(readState);

let settings: Settings | undefined = storage.loadSettings();
let feed: Feed | undefined;
let showRead = storage.loadShowRead();
// Stories read since the list loaded. They stay as strips. Stories read before stay out.
const readSinceLoad = new Set<string>();
let loading = false;
let loadFailed = false;
let shownCount = 0;

function render(): void {
  if (!feed || !settings) {
    return;
  }
  const entries = listed(feed, settings).map((story) => ({
    story,
    mode: rowMode(isRead(readState, story), readSinceLoad.has(story.sophoraId), showRead),
  }));
  renderRows(list, entries);
  shownCount = entries.filter((e) => e.mode !== 'hidden').length;
  renderStatus();
}

function canLoadMore(f: Feed): boolean {
  if (nextLoads(f).length === 0) {
    return false;
  }
  return (
    f.sources.some((s) => s.next === undefined) || olderMayShow(readState, cutoff(f), showRead)
  );
}

function renderStatus(): void {
  if (!feed) {
    status.replaceChildren();
  } else if (loadFailed) {
    status.replaceChildren(failure(() => void loadMore()));
  } else if (loading) {
    status.replaceChildren(el('p', {}, 'Wird geladen'));
  } else if (exhausted(feed)) {
    status.replaceChildren(el('p', {}, 'Keine älteren Artikel'));
  } else if (!canLoadMore(feed)) {
    status.replaceChildren(el('p', {}, 'Keine älteren ungelesenen Artikel'));
  } else {
    status.replaceChildren();
  }
}

async function loadMore(): Promise<void> {
  const f = feed;
  if (!f || loading || !canLoadMore(f)) {
    renderStatus();
    return;
  }
  loading = true;
  loadFailed = false;
  renderStatus();
  const before = shownCount;
  const loads = nextLoads(f);
  const results = await Promise.allSettled(loads.map((l) => fetchJson<NewsPage>(l.url)));
  if (f !== feed) {
    return;
  }
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      addPage(f, loads[i].source, r.value, true);
    } else {
      loadFailed = true;
    }
  });
  loading = false;
  render();
  if (!loadFailed && (shownCount === before || nearViewport(sentinel))) {
    void loadMore();
  }
}

async function refresh(): Promise<void> {
  const f = feed;
  if (!f || document.hidden) {
    return;
  }
  const loaded = f.sources.filter((s) => s.next !== undefined);
  const results = await Promise.allSettled(loaded.map((s) => fetchJson<NewsPage>(s.url)));
  if (f !== feed) {
    return;
  }
  let failed = false;
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      addPage(f, loaded[i], r.value, false);
    } else {
      failed = true;
    }
  });
  refreshStatus.replaceChildren(...(failed ? [failure(() => void refresh())] : []));
  render();
}

function reload(): void {
  feed = settings && createFeed(settings);
  readSinceLoad.clear();
  loading = false;
  loadFailed = false;
  clearRows(list);
  refreshStatus.replaceChildren();
  window.scrollTo(0, 0);
  void loadMore();
}

function storyOf(target: Element): Story | undefined {
  const id = target.closest<HTMLElement>('.row')?.dataset.id;
  return id === undefined ? undefined : feed?.stories.get(id);
}

function setRead(story: Story, read: boolean): void {
  if (read) {
    markRead(readState, story);
    readSinceLoad.add(story.sophoraId);
  } else {
    markUnread(readState, story);
    readSinceLoad.delete(story.sophoraId);
  }
  storage.saveReadState(readState);
  render();
}

list.addEventListener('click', (e) => {
  const target = e.target as Element;
  const story = storyOf(target);
  if (!story) {
    return;
  }
  e.preventDefault();
  if (target.closest('[data-action="toggle"]')) {
    setRead(story, !isRead(readState, story));
    // A row that turns into a strip can pull the sentinel into view.
    if (nearViewport(sentinel)) {
      void loadMore();
    }
    return;
  }
  setRead(story, true);
  openArticle(story);
});

byId('mark-all').addEventListener('click', () => {
  if (!feed || !settings) {
    return;
  }
  // Every row on screen turns into a strip. Stories the list hides stay hidden.
  for (const story of listed(feed, settings)) {
    const read = isRead(readState, story);
    if (rowMode(read, readSinceLoad.has(story.sophoraId), showRead) !== 'hidden') {
      readSinceLoad.add(story.sophoraId);
    }
  }
  markAllRead(readState, Date.now());
  storage.saveReadState(readState);
  render();
});

showReadToggle.checked = showRead;
showReadToggle.addEventListener('change', () => {
  showRead = showReadToggle.checked;
  storage.saveShowRead(showRead);
  render();
  if (nearViewport(sentinel)) {
    void loadMore();
  }
});

const settingsButton = byId('settings');
settingsButton.append(icon(ICON_SETTINGS));
settingsButton.addEventListener('click', () => openOnboarding(settings));

new IntersectionObserver(
  (entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      void loadMore();
    }
  },
  { rootMargin: '0px 0px 800px 0px' },
).observe(sentinel);

type Tab = 'news' | 'videos';
const tabButtons = document.querySelectorAll<HTMLButtonElement>('.tabs [data-tab]');
const newsParts = [byId('news-bar'), byId('news-view')];
const videosView = byId('videos-view');
// Each tab keeps its own scroll position.
const scrollOf: Record<Tab, number> = { news: 0, videos: 0 };
let tab: Tab = 'news';

function showTab(next: Tab): void {
  if (next === tab) {
    return;
  }
  scrollOf[tab] = window.scrollY;
  tab = next;
  for (const button of tabButtons) {
    button.setAttribute('aria-selected', String(button.dataset.tab === next));
  }
  for (const part of newsParts) {
    part.hidden = next !== 'news';
  }
  videosView.hidden = next !== 'videos';
  if (next === 'videos') {
    showVideos();
  }
  window.scrollTo(0, scrollOf[next]);
}

for (const button of tabButtons) {
  button.addEventListener('click', () => showTab(button.dataset.tab as Tab));
}

function refreshAll(): void {
  void refresh();
  void refreshVideos();
}

setInterval(refreshAll, REFRESH_MS);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    refreshAll();
  }
});

observeFit(list);
initModal(byId<HTMLDialogElement>('article'));
initOnboarding(byId<HTMLDialogElement>('onboarding'), (saved) => {
  settings = saved;
  storage.saveSettings(saved);
  reload();
});

if (settings) {
  reload();
} else {
  openOnboarding(undefined);
}
