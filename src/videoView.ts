import { fetchJson, type ArdShowPage } from './api';
import { byId, el, nearViewport } from './dom';
import { exhausted, nextLoads } from './feed';
import { observeFit, renderRows } from './list';
import { openVideo } from './modal';
import { failure } from './status';
import * as storage from './storage';
import { addVideoPage, createVideoFeed, listedVideos, type Video, type VideoFeed } from './videos';

const list = byId<HTMLElement>('video-list');
const sentinel = byId<HTMLElement>('video-sentinel');
const status = byId<HTMLElement>('video-status');

const watched = storage.loadWatched();
// Created when the Videos tab opens for the first time.
let feed: VideoFeed | undefined;
let loading = false;
let loadFailed = false;

function render(): void {
  if (!feed) {
    return;
  }
  renderRows(
    list,
    listedVideos(feed).map((video) => ({
      story: video,
      mode: video.sophoraId in watched ? 'dimmed' : 'unread',
    })),
  );
  renderStatus();
}

function renderStatus(): void {
  if (!feed) {
    status.replaceChildren();
  } else if (loadFailed) {
    status.replaceChildren(failure(() => void loadMore()));
  } else if (loading) {
    status.replaceChildren(el('p', {}, 'Wird geladen'));
  } else if (exhausted(feed)) {
    status.replaceChildren(el('p', {}, 'Keine älteren Videos'));
  } else {
    status.replaceChildren();
  }
}

async function loadMore(): Promise<void> {
  const f = feed;
  if (!f || loading || nextLoads(f).length === 0) {
    renderStatus();
    return;
  }
  loading = true;
  loadFailed = false;
  renderStatus();
  const loads = nextLoads(f);
  const results = await Promise.allSettled(loads.map((l) => fetchJson<ArdShowPage>(l.url)));
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      addVideoPage(f, loads[i].source, r.value, true);
    } else {
      loadFailed = true;
    }
  });
  loading = false;
  render();
  if (!loadFailed && nearViewport(sentinel)) {
    void loadMore();
  }
}

// Fetches the first page of each show again. A failure stays silent, the next refresh tries again.
export async function refreshVideos(): Promise<void> {
  const f = feed;
  if (!f || document.hidden) {
    return;
  }
  const loaded = f.sources.filter((s) => s.next !== undefined);
  const results = await Promise.allSettled(loaded.map((s) => fetchJson<ArdShowPage>(s.url)));
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      addVideoPage(f, loaded[i], r.value, false);
    }
  });
  render();
}

export function showVideos(): void {
  if (!feed) {
    feed = createVideoFeed();
    void loadMore();
  }
}

function setWatched(video: Video, on: boolean): void {
  if (on) {
    watched[video.sophoraId] = video.date;
  } else {
    delete watched[video.sophoraId];
  }
  storage.saveWatched(watched);
  render();
}

list.addEventListener('click', (e) => {
  const target = e.target as Element;
  const id = target.closest<HTMLElement>('.row')?.dataset.id;
  const video = id === undefined ? undefined : feed?.videos.get(id);
  if (!video) {
    return;
  }
  e.preventDefault();
  if (target.closest('[data-action="toggle"]')) {
    setWatched(video, !(video.sophoraId in watched));
    return;
  }
  openVideo(video, () => setWatched(video, true));
});

new IntersectionObserver(
  (entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      void loadMore();
    }
  },
  { rootMargin: '0px 0px 800px 0px' },
).observe(sentinel);

observeFit(list);
