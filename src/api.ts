export const NEWS_URL = 'https://www.tagesschau.de/api2u/news';
export const SPORT_URL = 'https://www.tagesschau.de/api2u/news?ressort=sport';

export type ImageVariants = Partial<Record<string, string>>;

export interface Image {
  title?: string;
  alttext?: string;
  copyright?: string;
  imageVariants?: ImageVariants;
}

export interface NewsItem {
  sophoraId: string;
  date: string;
  type: string;
  ressort?: string | null;
  regionId?: number | null;
  topline?: string;
  title: string;
  teaserImage?: Image;
  details?: string;
  detailsweb?: string;
  shareURL?: string;
  breakingNews?: boolean;
}

export interface NewsPage {
  news: NewsItem[];
  nextPage?: string | null;
}

export interface Video {
  title?: string;
  teaserImage?: Image;
  streams?: Partial<Record<string, string>>;
}

// One shape for every block type. The API adds fields per type: `value` for text and headline,
// `quotation` for a quote, `gallery` for images, `video` for a video. An audio block carries
// `title` and `stream` on the block itself.
export interface ContentBlock {
  type: string;
  value?: string;
  quotation?: { text?: string };
  gallery?: Image[];
  video?: Video;
  title?: string;
  stream?: string;
}

export interface Article {
  topline?: string;
  title: string;
  date: string;
  shareURL?: string;
  detailsweb?: string;
  content?: ContentBlock[];
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${url} answered ${res.status}`);
  }
  return (await res.json()) as T;
}
