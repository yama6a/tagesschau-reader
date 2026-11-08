import { describe, expect, it } from 'vitest';
import { NEWS_URL, SPORT_URL, type NewsItem } from './api';
import {
  addPage,
  createFeed,
  cutoff,
  exhausted,
  keep,
  listed,
  nextLoads,
  type Story,
} from './feed';
import type { Settings } from './settings';

function item(id: string, date: string, extra: Partial<NewsItem> = {}): NewsItem {
  return {
    sophoraId: id,
    date,
    type: 'story',
    regionId: 0,
    ressort: 'inland',
    title: id,
    ...extra,
  };
}

function story(extra: Partial<NewsItem>): Story {
  const i = item('x', '2026-11-08T10:00:00+01:00', extra);
  return { ...i, time: Date.parse(i.date) };
}

const news: Settings = { categories: ['inland', 'ausland'], regions: [] };

describe('createFeed', () => {
  it('loads the full feed for news categories and the sport feed for sport', () => {
    expect(
      createFeed({ categories: ['inland', 'sport'], regions: [] }).sources.map((s) => s.url),
    ).toEqual([NEWS_URL, SPORT_URL]);
    expect(createFeed({ categories: ['sport'], regions: [] }).sources.map((s) => s.url)).toEqual([
      SPORT_URL,
    ]);
    expect(createFeed({ categories: [], regions: [8] }).sources.map((s) => s.url)).toEqual([
      NEWS_URL,
    ]);
  });
});

describe('keep', () => {
  it('keeps nationwide stories of a selected category', () => {
    expect(keep(story({ ressort: 'inland' }), news)).toBe(true);
    expect(keep(story({ ressort: 'wissen' }), news)).toBe(false);
  });

  it('drops nationwide stories without a ressort unless Weitere is selected', () => {
    const url = 'https://www.tagesschau.de/kultur/janosch-gestorben-100.html';
    expect(keep(story({ ressort: null, detailsweb: url }), news)).toBe(false);
  });

  it('keeps nationwide stories without a ressort when Weitere is selected', () => {
    const weitere: Settings = { categories: ['weitere'], regions: [] };
    for (const path of [
      'kultur/janosch-gestorben-100.html',
      'newsticker/liveblog-midterms-2026-104.html',
      'kommentar/usa-midterms-120.html',
      'eilmeldung/usa-midterms-118.html',
      'politikwissenschaftler-mueller-midterms-100.html',
    ]) {
      const detailsweb = `https://www.tagesschau.de/${path}`;
      expect(keep(story({ ressort: null, detailsweb }), weitere)).toBe(true);
    }
    expect(keep(story({ ressort: null }), weitere)).toBe(true);
  });

  it('drops the weather, ARD studio and livestream pages from Weitere', () => {
    const weitere: Settings = { categories: ['weitere'], regions: [] };
    for (const path of [
      'wetter/europa-welt',
      'wetter/deutschland/wettervorhersage-deutschland-100.html',
      'korrespondenten/studio-washington-101.html',
      'korrespondenten/studio-prag-101.html',
      'multimedia/livestreams/livestream-ts24-104.html',
    ]) {
      const detailsweb = `https://www.tagesschau.de/${path}`;
      expect(keep(story({ ressort: null, detailsweb }), weitere)).toBe(false);
    }
  });

  it('does not count stories with a ressort as Weitere', () => {
    const weitere: Settings = { categories: ['weitere'], regions: [] };
    expect(keep(story({ ressort: 'inland' }), weitere)).toBe(false);
  });

  it('keeps regional stories of a selected state whatever their ressort', () => {
    const settings: Settings = { categories: [], regions: [8, 10] };
    expect(keep(story({ regionId: 8, ressort: null }), settings)).toBe(true);
    expect(keep(story({ regionId: 2, ressort: null }), settings)).toBe(false);
  });

  it('drops regional stories of a selected category when the state is not selected', () => {
    expect(keep(story({ regionId: 8, ressort: 'inland' }), news)).toBe(false);
  });

  it('drops videos', () => {
    expect(keep(story({ type: 'video' }), news)).toBe(false);
  });
});

describe('addPage', () => {
  it('removes duplicates across pages and sources', () => {
    const feed = createFeed({ categories: ['inland', 'sport'], regions: [] });
    const [all, sport] = feed.sources;
    addPage(feed, all, { news: [item('a', '2026-11-08T10:00:00+01:00')], nextPage: 'p2' }, true);
    addPage(feed, sport, { news: [item('a', '2026-11-08T10:00:00+01:00')], nextPage: null }, true);
    addPage(feed, all, { news: [item('a', '2026-11-08T10:00:00+01:00')], nextPage: 'p3' }, true);
    expect([...feed.stories.keys()]).toEqual(['a']);
  });

  it('gives sport feed stories without a ressort the ressort sport', () => {
    const feed = createFeed({ categories: ['sport'], regions: [] });
    addPage(
      feed,
      feed.sources[0],
      { news: [item('s', '2026-11-08T10:00:00+01:00', { ressort: null })] },
      true,
    );
    expect(feed.stories.get('s')?.ressort).toBe('sport');
    expect(listed(feed, { categories: ['sport'], regions: [] }).map((s) => s.sophoraId)).toEqual([
      's',
    ]);
  });

  it('keeps the place in older pages when a first page is fetched again', () => {
    const feed = createFeed(news);
    const [all] = feed.sources;
    addPage(feed, all, { news: [item('a', '2026-11-08T10:00:00+01:00')], nextPage: 'day-1' }, true);
    addPage(feed, all, { news: [item('b', '2026-11-07T10:00:00+01:00')], nextPage: 'day-2' }, true);
    addPage(
      feed,
      all,
      { news: [item('c', '2026-11-08T11:00:00+01:00')], nextPage: 'day-1' },
      false,
    );
    expect(all.next).toBe('day-2');
    expect(listed(feed, news).map((s) => s.sophoraId)).toEqual(['c', 'a', 'b']);
  });
});

describe('listed', () => {
  it('sorts newest first and pins breaking news on top', () => {
    const feed = createFeed(news);
    addPage(
      feed,
      feed.sources[0],
      {
        news: [
          item('old', '2026-11-08T08:00:00+01:00'),
          item('breaking', '2026-11-08T07:00:00+01:00', { breakingNews: true }),
          item('new', '2026-11-08T09:00:00+01:00'),
        ],
        nextPage: 'p2',
      },
      true,
    );
    expect(listed(feed, news).map((s) => s.sophoraId)).toEqual(['breaking', 'new', 'old']);
  });

  it('hides stories older than the source that reaches least far back', () => {
    const settings: Settings = { categories: ['inland', 'sport'], regions: [] };
    const feed = createFeed(settings);
    const [all, sport] = feed.sources;
    addPage(feed, all, { news: [item('a', '2026-11-08T10:00:00+01:00')], nextPage: 'p2' }, true);
    addPage(
      feed,
      sport,
      { news: [item('s', '2026-11-05T10:00:00+01:00', { ressort: null })], nextPage: 'p2' },
      true,
    );
    expect(cutoff(feed)).toBe(Date.parse('2026-11-08T10:00:00+01:00'));
    expect(listed(feed, settings).map((s) => s.sophoraId)).toEqual(['a']);
    expect(nextLoads(feed)).toEqual([{ source: all, url: 'p2' }]);
  });

  it('lets a source with no older page stop holding the others back', () => {
    const settings: Settings = { categories: ['inland', 'sport'], regions: [] };
    const feed = createFeed(settings);
    const [all, sport] = feed.sources;
    addPage(feed, all, { news: [item('a', '2026-11-08T10:00:00+01:00')], nextPage: 'p2' }, true);
    addPage(
      feed,
      sport,
      { news: [item('s', '2024-06-28T10:00:00+02:00', { ressort: null })], nextPage: null },
      true,
    );
    expect(listed(feed, settings).map((s) => s.sophoraId)).toEqual(['a']);
    addPage(feed, all, { news: [], nextPage: null }, true);
    expect(exhausted(feed)).toBe(true);
    expect(listed(feed, settings).map((s) => s.sophoraId)).toEqual(['a', 's']);
  });
});

describe('nextLoads', () => {
  it('fetches every missing first page before any older page', () => {
    const feed = createFeed({ categories: ['inland', 'sport'], regions: [] });
    expect(nextLoads(feed).map((l) => l.url)).toEqual([NEWS_URL, SPORT_URL]);
  });

  it('is empty when every source is done', () => {
    const feed = createFeed(news);
    addPage(feed, feed.sources[0], { news: [], nextPage: null }, true);
    expect(nextLoads(feed)).toEqual([]);
  });
});
