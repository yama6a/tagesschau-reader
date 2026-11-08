import { NEWS_URL, SPORT_URL, type NewsItem, type NewsPage } from './api';
import type { Settings } from './settings';

export interface Story extends NewsItem {
  time: number;
}

// One paged list of the API. `next` is undefined before the first page arrives and null once the
// API has no older page. `oldest` is the time of the oldest item loaded from this source.
export interface Source {
  url: string;
  next: string | null | undefined;
  oldest: number;
  // The sport feed sends ressort null on its stories, so they get this ressort instead.
  ressort?: string;
}

export interface Feed {
  sources: Source[];
  stories: Map<string, Story>;
}

export function createFeed(settings: Settings): Feed {
  const sources: Source[] = [];
  const nonSport = settings.categories.some((c) => c !== 'sport');
  if (nonSport || settings.regions.length > 0) {
    sources.push({ url: NEWS_URL, next: undefined, oldest: Infinity });
  }
  if (settings.categories.includes('sport')) {
    sources.push({ url: SPORT_URL, next: undefined, oldest: Infinity, ressort: 'sport' });
  }
  return { sources, stories: new Map() };
}

// Adds one page of a source. A first page fetched again for new stories passes advance false, so
// the source keeps its place in the older pages.
export function addPage(feed: Feed, source: Source, page: NewsPage, advance: boolean): void {
  for (const item of page.news) {
    const time = Date.parse(item.date);
    if (Number.isNaN(time)) {
      continue;
    }
    const known = feed.stories.get(item.sophoraId);
    feed.stories.set(item.sophoraId, {
      ...item,
      ressort: item.ressort ?? known?.ressort ?? source.ressort ?? null,
      time,
    });
    source.oldest = Math.min(source.oldest, time);
  }
  if (advance || source.next === undefined) {
    source.next = page.nextPage ?? null;
  }
}

export function keep(story: Story, settings: Settings): boolean {
  if (story.type !== 'story') {
    return false;
  }
  if (story.regionId === 0 && settings.categories.some((c) => c === story.ressort)) {
    return true;
  }
  return story.regionId != null && settings.regions.includes(story.regionId);
}

// Stories older than this may still have newer neighbours in a source that has not paged that
// far back yet. Hiding them keeps the order stable when the next page arrives.
export function cutoff(feed: Feed): number {
  let limit = -Infinity;
  for (const s of feed.sources) {
    if (typeof s.next === 'string') {
      limit = Math.max(limit, s.oldest);
    }
  }
  return limit;
}

// The stories to list, breaking news first, then newest first.
export function listed(feed: Feed, settings: Settings): Story[] {
  const limit = cutoff(feed);
  return [...feed.stories.values()]
    .filter((s) => s.time >= limit && keep(s, settings))
    .sort((a, b) => Number(!!b.breakingNews) - Number(!!a.breakingNews) || b.time - a.time);
}

export interface Load {
  source: Source;
  url: string;
}

// The pages to fetch next: every missing first page, or else the next page of the source that
// reaches least far back. Empty when every source is done.
export function nextLoads(feed: Feed): Load[] {
  const missing = feed.sources.filter((s) => s.next === undefined);
  if (missing.length > 0) {
    return missing.map((source) => ({ source, url: source.url }));
  }
  let pick: Source | undefined;
  for (const s of feed.sources) {
    if (typeof s.next === 'string' && (!pick || s.oldest > pick.oldest)) {
      pick = s;
    }
  }
  return pick ? [{ source: pick, url: pick.next as string }] : [];
}

export function exhausted(feed: Feed): boolean {
  return feed.sources.every((s) => s.next === null);
}
