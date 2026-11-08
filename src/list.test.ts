import { describe, expect, it } from 'vitest';
import { formatRowDate } from './dom';
import { fitTitle } from './list';

function row(heightAt: (scale: number) => number, boxHeight = 100): HTMLElement {
  const article = document.createElement('article');
  const body = document.createElement('div');
  body.className = 'body';
  Object.defineProperty(body, 'clientHeight', { value: boxHeight });
  Object.defineProperty(body, 'scrollHeight', {
    get: () => heightAt(Number(article.style.getPropertyValue('--fit'))),
  });
  article.append(body);
  return article;
}

describe('fitTitle', () => {
  it('keeps the normal size when the title fits', () => {
    const r = row(() => 90);
    fitTitle(r);
    expect(r.style.getPropertyValue('--fit')).toBe('1');
    expect(r.dataset.grow).toBeUndefined();
  });

  it('lowers the size until the title fits', () => {
    const r = row((scale) => 140 * scale);
    fitTitle(r);
    expect(r.style.getPropertyValue('--fit')).toBe('0.7');
    expect(r.dataset.grow).toBeUndefined();
    const r2 = row((scale) => 110 * scale);
    fitTitle(r2);
    expect(r2.style.getPropertyValue('--fit')).toBe('0.9');
  });

  it('lets the row grow when 70% is still too big', () => {
    const r = row((scale) => 200 * scale);
    fitTitle(r);
    expect(r.style.getPropertyValue('--fit')).toBe('0.7');
    expect(r.dataset.grow).toBe('');
  });
});

describe('formatRowDate', () => {
  it('shows day, month and 24-hour time in German time', () => {
    expect(formatRowDate('2026-11-08T08:12:00Z')).toBe('08.11. 09:12');
    expect(formatRowDate('2026-07-01T22:05:00Z')).toBe('02.07. 00:05');
  });
});
