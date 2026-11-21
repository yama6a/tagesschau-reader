import {
  ARD_API,
  type ArdImage,
  type ArdItem,
  type ArdMedia,
  type ArdShowPage,
  type ArdTeaser,
  type Image,
} from './api';
import { cutoff, type Paged } from './feed';

// The base64 of crid://daserste.de/tagesschau and crid://daserste.de/tagesthemen.
const SHOWS = [
  'Y3JpZDovL2Rhc2Vyc3RlLmRlL3RhZ2Vzc2NoYXU',
  'Y3JpZDovL2Rhc2Vyc3RlLmRlL3RhZ2VzdGhlbWVu',
];
const PAGE_SIZE = 50;

// The show lists also hold single reports. A broadcast has a title such as
// "tagesthemen 21:45 Uhr, 20.11.2026" or "tagesthemen extra 20:15 Uhr, 03.11.2026".
const BROADCAST = /^(tagesschau|tagesthemen)( extra)? \d{1,2}:\d{2} Uhr/;

const HLS = 'application/vnd.apple.mpegurl';

// The list draws news stories and videos with the same row, so a video carries the same field
// names. `sophoraId` holds the ARD id.
export interface Video {
  sophoraId: string;
  date: string;
  time: number;
  title: string;
  teaserImage?: Image;
  poster?: string;
  detailsweb: string;
}

export interface ShowSource extends Paged {
  show: string;
}

export interface VideoFeed {
  sources: ShowSource[];
  videos: Map<string, Video>;
}

export function showPageUrl(show: string, page: number): string {
  return `${ARD_API}/widgets/ard/asset/${show}?pageNumber=${page}&pageSize=${PAGE_SIZE}`;
}

export function itemUrl(id: string): string {
  return `${ARD_API}/pages/ard/item/${id}?embedded=true`;
}

export function createVideoFeed(): VideoFeed {
  return {
    sources: SHOWS.map((show) => ({
      show,
      url: showPageUrl(show, 0),
      next: undefined,
      oldest: Infinity,
    })),
    videos: new Map(),
  };
}

function imageAt(image: ArdImage | undefined, width: number): string | undefined {
  return image?.src.replace('{width}', String(width));
}

function toVideo(teaser: ArdTeaser, time: number): Video {
  const square = teaser.images?.aspect1x1;
  return {
    sophoraId: teaser.id,
    date: teaser.broadcastedOn,
    time,
    title: teaser.longTitle,
    teaserImage: square && {
      alttext: square.alt,
      imageVariants: { '1x1-256': imageAt(square, 256), '1x1-432': imageAt(square, 432) },
    },
    poster: imageAt(teaser.images?.aspect16x9, 960),
    detailsweb: `https://www.ardmediathek.de/video/${teaser.id}`,
  };
}

// Adds one page of a show. A first page fetched again for new broadcasts passes advance false, so
// the source keeps its place in the older pages.
export function addVideoPage(
  feed: VideoFeed,
  source: ShowSource,
  page: ArdShowPage,
  advance: boolean,
): void {
  for (const teaser of page.teasers) {
    const time = Date.parse(teaser.broadcastedOn);
    if (Number.isNaN(time)) {
      continue;
    }
    source.oldest = Math.min(source.oldest, time);
    if (BROADCAST.test(teaser.longTitle)) {
      feed.videos.set(teaser.id, toVideo(teaser, time));
    }
  }
  if (advance || source.next === undefined) {
    const { pageNumber, pageSize, totalElements } = page.pagination;
    const more = page.teasers.length > 0 && (pageNumber + 1) * pageSize < totalElements;
    source.next = more ? showPageUrl(source.show, pageNumber + 1) : null;
  }
}

export function listedVideos(feed: VideoFeed): Video[] {
  const limit = cutoff(feed);
  return [...feed.videos.values()].filter((v) => v.time >= limit).sort((a, b) => b.time - a.time);
}

// HLS first, because it adapts to the connection. A browser that cannot play HLS takes the next
// source, the largest MP4 of at most 720 lines.
export function playable(item: ArdItem): ArdMedia[] {
  const media = item.widgets[0]?.mediaCollection?.embedded?.streams?.[0]?.media ?? [];
  const hls = media.find((m) => m.mimeType === HLS);
  const mp4 = media
    .filter((m) => m.mimeType === 'video/mp4' && (m.maxVResolutionPx ?? 0) <= 720)
    .sort((a, b) => (b.maxVResolutionPx ?? 0) - (a.maxVResolutionPx ?? 0))[0];
  return [hls, mp4].filter((m) => m !== undefined);
}
