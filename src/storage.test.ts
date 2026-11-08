import { beforeEach, describe, expect, it } from 'vitest';
import { loadReadState, loadSettings, loadShowRead, saveReadState, saveSettings } from './storage';

beforeEach(() => localStorage.clear());

describe('storage', () => {
  it('keeps every value under one versioned prefix', () => {
    saveSettings({ categories: ['inland'], regions: [3] });
    saveReadState({ readIds: { a: '2026-11-08T10:00:00+01:00' }, unreadIds: {}, readBefore: 5 });
    expect(Object.keys(localStorage).every((k) => k.startsWith('tagesschau-reader.v1.'))).toBe(
      true,
    );
    expect(loadSettings()).toEqual({ categories: ['inland'], regions: [3] });
    expect(loadReadState().readBefore).toBe(5);
  });

  it('falls back to defaults on missing or broken values', () => {
    localStorage.setItem('tagesschau-reader.v1.settings', '{broken');
    expect(loadSettings()).toBeUndefined();
    expect(loadShowRead()).toBe(false);
    expect(loadReadState()).toEqual({ readIds: {}, unreadIds: {}, readBefore: 0 });
  });
});
