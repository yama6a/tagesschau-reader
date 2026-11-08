import { describe, expect, it } from 'vitest';
import type { ContentBlock } from './api';
import { renderContent, sanitize, videoSource, webUrlGuess } from './content';

function html(blocks: ContentBlock[]): string {
  const div = document.createElement('div');
  div.append(renderContent(blocks));
  return div.innerHTML;
}

describe('sanitize', () => {
  it('keeps only the allowed tags and drops scripts and handlers', () => {
    const div = document.createElement('div');
    div.append(
      sanitize(
        '<strong>a</strong><img src=x onerror=alert(1)><script>alert(2)</script><span>b</span>',
      ),
    );
    expect(div.innerHTML).toBe('<strong>a</strong>b');
  });

  it('opens external links in a new tab without the opener', () => {
    const div = document.createElement('div');
    div.append(sanitize('<a href="https://example.org/" type="extern" style="x">x</a>'));
    expect(div.innerHTML).toBe(
      '<a href="https://example.org/" target="_blank" rel="noopener noreferrer">x</a>',
    );
  });

  it('points links to article JSON at the web page and keeps the JSON address', () => {
    const div = document.createElement('div');
    const api = 'https://www.tagesschau.de/api2u/inland/innenpolitik/merz-afd-verbot-102.json';
    div.append(sanitize(`<a href="${api}" type="intern">x</a>`));
    const a = div.querySelector('a');
    expect(a?.getAttribute('href')).toBe(
      'https://www.tagesschau.de/inland/innenpolitik/merz-afd-verbot-102.html',
    );
    expect(a?.dataset.api).toBe(api);
  });

  it('drops javascript links', () => {
    const div = document.createElement('div');
    div.append(sanitize('<a href="javascript:alert(1)">x</a>'));
    expect(div.querySelector('a')?.hasAttribute('href')).toBe(false);
  });
});

describe('webUrlGuess', () => {
  it('maps API paths to web pages and ignores other links', () => {
    expect(webUrlGuess('https://www.tagesschau.de/api2u/ausland/aigner-ts-114.json')).toBe(
      'https://www.tagesschau.de/ausland/aigner-ts-114.html',
    );
    expect(webUrlGuess('https://www.tagesschau.de/ausland/aigner-ts-114.html')).toBeUndefined();
  });
});

describe('videoSource', () => {
  it('prefers the h264m MP4 and falls back to other sizes, then HLS', () => {
    expect(videoSource({ h264s: 's', h264m: 'm', h264xl: 'xl' })).toBe('m');
    expect(videoSource({ avc270: '270', avc360: '360' })).toBe('360');
    expect(videoSource({ adaptivestreaming: 'hls' })).toBe('hls');
    expect(videoSource(undefined)).toBeUndefined();
  });
});

describe('renderContent', () => {
  it('renders text, headline and quotation blocks', () => {
    expect(
      html([
        { type: 'text', value: 'Ein <em>Satz</em>.' },
        { type: 'headline', value: '<h2>Titel</h2>' },
        { type: 'quotation', quotation: { text: '"Zitat"' } },
      ]),
    ).toBe(
      '<div class="text">Ein <em>Satz</em>.</div><h2>Titel</h2><blockquote>"Zitat"</blockquote>',
    );
  });

  it('drops boxes, related links, social media, embeds and unknown blocks', () => {
    expect(
      html([
        { type: 'box' },
        { type: 'related' },
        { type: 'socialmedia' },
        { type: 'htmlEmbed' },
        { type: 'webview' },
      ]),
    ).toBe('');
  });

  it('renders a gallery image with its caption', () => {
    const out = html([
      {
        type: 'image_gallery',
        gallery: [
          {
            title: 'Ein Bild',
            copyright: 'dpa',
            alttext: 'Alt',
            imageVariants: { '16x9-640': 'https://i/640.jpg', '16x9-960': 'https://i/960.jpg' },
          },
        ],
      },
    ]);
    expect(out).toContain('src="https://i/640.jpg"');
    expect(out).toContain('srcset="https://i/640.jpg 640w, https://i/960.jpg 960w"');
    expect(out).toContain('alt="Alt"');
    expect(out).toContain('<figcaption>Ein Bild Bildquelle: dpa</figcaption>');
  });

  it('renders a video with poster and an audio player', () => {
    const div = document.createElement('div');
    div.append(
      renderContent([
        {
          type: 'video',
          video: {
            title: 'Video',
            streams: { h264m: 'https://v/m.mp4' },
            teaserImage: { imageVariants: { '16x9-640': 'https://i/p.jpg' } },
          },
        },
        { type: 'audio', title: 'Audio', stream: 'https://a/x.mp3' },
      ]),
    );
    const video = div.querySelector('video');
    expect(video?.getAttribute('src')).toBe('https://v/m.mp4');
    expect(video?.getAttribute('poster')).toBe('https://i/p.jpg');
    expect(video?.getAttribute('preload')).toBe('none');
    expect(video?.hasAttribute('playsinline')).toBe(true);
    const audio = div.querySelector('audio');
    expect(audio?.getAttribute('src')).toBe('https://a/x.mp3');
    expect(audio?.getAttribute('preload')).toBe('none');
  });
});
