import { describe, expect, it } from 'vitest';
import type { ArdItem, ArdShowPage, ArdTeaser } from './api';
import { nextLoads } from './feed';
import { addVideoPage, createVideoFeed, listedVideos, playable, showPageUrl } from './videos';

function teaser(id: string, title: string, at: string): ArdTeaser {
  return {
    id,
    longTitle: title,
    broadcastedOn: at,
    images: {
      aspect1x1: {
        alt: 'Sendungsbild',
        src: `https://api.ardmediathek.de/image-service/${id}?w={width}`,
      },
    },
  };
}

function page(teasers: ArdTeaser[], pageNumber = 0, totalElements = 1000): ArdShowPage {
  return { teasers, pagination: { pageNumber, pageSize: 50, totalElements } };
}

describe('addVideoPage', () => {
  it('keeps broadcasts and drops single reports', () => {
    const feed = createVideoFeed();
    addVideoPage(
      feed,
      feed.sources[1],
      page([
        teaser('a', 'tagesthemen 21:45 Uhr, 20.11.2026', '2026-11-20T20:45:00Z'),
        teaser('b', 'Zwickau · Pilot-Projekt in VW-Werk', '2026-11-19T21:15:00Z'),
        teaser('c', 'tagesthemen extra 20:15 Uhr, 19.11.2026', '2026-11-19T19:15:00Z'),
      ]),
      true,
    );
    expect([...feed.videos.keys()]).toEqual(['a', 'c']);
    expect(feed.sources[1].oldest).toBe(Date.parse('2026-11-19T19:15:00Z'));
  });

  it('builds the row image and the Mediathek link', () => {
    const feed = createVideoFeed();
    addVideoPage(
      feed,
      feed.sources[0],
      page([teaser('a', 'tagesschau 20:00 Uhr, 21.11.2026', '2026-11-21T19:00:00Z')]),
      true,
    );
    const video = feed.videos.get('a');
    expect(video?.teaserImage?.imageVariants?.['1x1-256']).toBe(
      'https://api.ardmediathek.de/image-service/a?w=256',
    );
    expect(video?.detailsweb).toBe('https://www.ardmediathek.de/video/a');
  });

  it('points to the next page until the show has no more', () => {
    const feed = createVideoFeed();
    const source = feed.sources[0];
    const t = teaser('a', 'tagesschau 20:00 Uhr, 21.11.2026', '2026-11-21T19:00:00Z');
    addVideoPage(feed, source, page([t], 0, 120), true);
    expect(source.next).toBe(showPageUrl(source.show, 1));
    addVideoPage(feed, source, page([t], 2, 120), true);
    expect(source.next).toBeNull();
  });

  it('keeps the place in older pages when the first page comes again', () => {
    const feed = createVideoFeed();
    const source = feed.sources[0];
    const t = teaser('a', 'tagesschau 20:00 Uhr, 21.11.2026', '2026-11-21T19:00:00Z');
    addVideoPage(feed, source, page([t], 0), true);
    addVideoPage(feed, source, page([t], 1), true);
    addVideoPage(feed, source, page([t], 0), false);
    expect(source.next).toBe(showPageUrl(source.show, 2));
  });
});

describe('listedVideos', () => {
  it('lists both shows newest first, up to the show that reaches least far back', () => {
    const feed = createVideoFeed();
    const [tagesschau, tagesthemen] = feed.sources;
    addVideoPage(
      feed,
      tagesschau,
      page([
        teaser('ts20', 'tagesschau 20:00 Uhr, 21.11.2026', '2026-11-21T19:00:00Z'),
        teaser('ts17', 'tagesschau 17:00 Uhr, 21.11.2026', '2026-11-21T16:00:00Z'),
      ]),
      true,
    );
    addVideoPage(
      feed,
      tagesthemen,
      page([
        teaser('tt20', 'tagesthemen 21:45 Uhr, 20.11.2026', '2026-11-20T20:45:00Z'),
        teaser('tt19', 'tagesthemen 22:15 Uhr, 19.11.2026', '2026-11-19T21:15:00Z'),
      ]),
      true,
    );
    expect(listedVideos(feed).map((v) => v.sophoraId)).toEqual(['ts20', 'ts17']);
    expect(nextLoads(feed).map((l) => l.source)).toEqual([tagesschau]);
  });
});

describe('playable', () => {
  it('offers HLS first, then the largest MP4 of at most 720 lines', () => {
    const item: ArdItem = {
      widgets: [
        {
          mediaCollection: {
            embedded: {
              streams: [
                {
                  media: [
                    { url: 'xxl.mp4', mimeType: 'video/mp4', maxVResolutionPx: 1080 },
                    { url: 'l.mp4', mimeType: 'video/mp4', maxVResolutionPx: 540 },
                    {
                      url: 'master.m3u8',
                      mimeType: 'application/vnd.apple.mpegurl',
                      maxVResolutionPx: 1080,
                    },
                    { url: 'xl.mp4', mimeType: 'video/mp4', maxVResolutionPx: 720 },
                  ],
                },
              ],
            },
          },
        },
      ],
    };
    expect(playable(item).map((m) => m.url)).toEqual(['master.m3u8', 'xl.mp4']);
    expect(playable({ widgets: [] })).toEqual([]);
  });
});
