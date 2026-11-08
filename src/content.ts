import DOMPurify from 'dompurify';
import type { ContentBlock, Image, Video } from './api';
import { el } from './dom';

const ALLOWED_TAGS = ['p', 'b', 'strong', 'i', 'em', 'br', 'ul', 'ol', 'li', 'h2', 'h3', 'a'];
const API_LINK = /^https:\/\/www\.tagesschau\.de\/api2u\/(.+)\.json$/;

// The web page for a link to article JSON. This holds for tagesschau.de articles. Articles of
// sportschau.de and the regional broadcasters live on their own host under another name, so a
// click on such a link reads the real address from the JSON first.
export function webUrlGuess(apiUrl: string): string | undefined {
  const m = API_LINK.exec(apiUrl);
  return m ? `https://www.tagesschau.de/${m[1]}.html` : undefined;
}

export function sanitize(html: string): DocumentFragment {
  const frag = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href'],
    RETURN_DOM_FRAGMENT: true,
  });
  for (const a of frag.querySelectorAll('a')) {
    const href = a.getAttribute('href') ?? '';
    const guess = webUrlGuess(href);
    if (guess) {
      a.setAttribute('href', guess);
      a.dataset.api = href;
    }
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
  return frag;
}

// h264m is the MP4 the brief asks for. Only tagesschau, BR and Radio Bremen send it. NDR and MDR
// send avc sizes, SWR and RBB only h264xl, and WDR, HR and SR only HLS.
const VIDEO_KEYS = ['h264m', 'avc360', 'h264xl', 'h264s', 'avc720', 'avc270', 'adaptivestreaming'];

export function videoSource(streams: Video['streams']): string | undefined {
  for (const key of VIDEO_KEYS) {
    const url = streams?.[key];
    if (url) {
      return url;
    }
  }
  return undefined;
}

function variant(image: Image | undefined, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const url = image?.imageVariants?.[key];
    if (url) {
      return url;
    }
  }
  return undefined;
}

function figure(image: Image): HTMLElement | undefined {
  const src = variant(image, '16x9-640', '16x9-960', '1x1-640');
  if (!src) {
    return undefined;
  }
  const srcset = ['640', '960', '1280']
    .map((w) => [variant(image, `16x9-${w}`), w] as const)
    .filter(([url]) => url)
    .map(([url, w]) => `${url} ${w}w`)
    .join(', ');
  const img = el('img', { src, alt: image.alttext ?? '', loading: 'lazy' });
  if (srcset) {
    img.srcset = srcset;
    img.sizes = '(min-width: 720px) 720px, 100vw';
  }
  const caption = [image.title, image.copyright && `Bildquelle: ${image.copyright}`].filter(
    Boolean,
  );
  return el(
    'figure',
    {},
    img,
    ...(caption.length ? [el('figcaption', {}, caption.join(' '))] : []),
  );
}

function videoFigure(video: Video | undefined): HTMLElement | undefined {
  const src = videoSource(video?.streams);
  if (!src) {
    return undefined;
  }
  const player = el('video', { controls: '', preload: 'none', playsinline: '', src });
  const poster = variant(video?.teaserImage, '16x9-640', '16x9-960');
  if (poster) {
    player.poster = poster;
  }
  return el('figure', {}, player, ...(video?.title ? [el('figcaption', {}, video.title)] : []));
}

function audioFigure(block: ContentBlock): HTMLElement | undefined {
  if (!block.stream) {
    return undefined;
  }
  const player = el('audio', { controls: '', preload: 'none', src: block.stream });
  return el('figure', {}, ...(block.title ? [el('figcaption', {}, block.title)] : []), player);
}

function renderBlock(block: ContentBlock): Node[] {
  switch (block.type) {
    case 'text':
      return [el('div', { class: 'text' }, sanitize(block.value ?? ''))];
    case 'headline':
      return [sanitize(block.value ?? '')];
    case 'quotation':
      return [el('blockquote', {}, sanitize(block.quotation?.text ?? ''))];
    case 'image_gallery':
      return (block.gallery ?? []).map(figure).filter((f) => f !== undefined);
    case 'video':
      return [videoFigure(block.video)].filter((f) => f !== undefined);
    case 'audio':
      return [audioFigure(block)].filter((f) => f !== undefined);
    default:
      return [];
  }
}

export function renderContent(blocks: ContentBlock[]): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const block of blocks) {
    frag.append(...renderBlock(block));
  }
  return frag;
}
