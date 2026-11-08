import { describe, expect, it } from 'vitest';
import {
  emptyReadState,
  isRead,
  markAllRead,
  markRead,
  markUnread,
  olderMayShow,
  prune,
  rowMode,
} from './readState';

function story(id: string, date: string) {
  return { sophoraId: id, date, time: Date.parse(date) };
}

const a = story('a', '2026-11-08T10:00:00+01:00');
const b = story('b', '2026-11-07T10:00:00+01:00');
const now = Date.parse('2026-11-08T12:00:00+01:00');

describe('read state', () => {
  it('marks a story read and unread again', () => {
    const s = emptyReadState();
    markRead(s, a);
    expect(isRead(s, a)).toBe(true);
    expect(isRead(s, b)).toBe(false);
    markUnread(s, a);
    expect(isRead(s, a)).toBe(false);
  });

  it('counts every story up to readBefore as read, also stories not loaded yet', () => {
    const s = emptyReadState();
    markAllRead(s, Date.parse('2026-11-08T09:00:00+01:00'));
    expect(isRead(s, b)).toBe(true);
    expect(isRead(s, a)).toBe(false);
  });

  it('keeps a story unread that the reader marked unread after marking all read', () => {
    const s = emptyReadState();
    markAllRead(s, now);
    markUnread(s, b);
    expect(isRead(s, b)).toBe(false);
    expect(s.unreadIds).toEqual({ b: b.date });
    markRead(s, b);
    expect(isRead(s, b)).toBe(true);
    expect(s.unreadIds).toEqual({});
  });

  it('forgets earlier unread marks when all are marked read again', () => {
    const s = emptyReadState();
    markAllRead(s, now);
    markUnread(s, b);
    markAllRead(s, now + 1000);
    expect(isRead(s, b)).toBe(true);
  });

  it('prunes entries older than 35 days', () => {
    const s = emptyReadState();
    markRead(s, story('old', '2026-10-01T10:00:00+02:00'));
    markRead(s, a);
    s.unreadIds.olderUnread = '2026-09-01T10:00:00+02:00';
    s.unreadIds.broken = 'not a date';
    prune(s, now);
    expect(Object.keys(s.readIds)).toEqual(['a']);
    expect(s.unreadIds).toEqual({});
  });
});

describe('olderMayShow', () => {
  it('stops paging when every older story counts as read', () => {
    const s = emptyReadState();
    markAllRead(s, now);
    expect(olderMayShow(s, a.time, false)).toBe(false);
    expect(olderMayShow(s, a.time, true)).toBe(true);
    markUnread(s, b);
    expect(olderMayShow(s, a.time, false)).toBe(true);
  });

  it('keeps paging while the loaded stories are newer than readBefore', () => {
    const s = emptyReadState();
    markAllRead(s, b.time);
    expect(olderMayShow(s, a.time, false)).toBe(true);
  });
});

describe('rowMode', () => {
  it('shows unread stories in full', () => {
    expect(rowMode(false, false, false)).toBe('unread');
  });

  it('collapses a story read since the page loaded and hides older reads', () => {
    expect(rowMode(true, true, false)).toBe('collapsed');
    expect(rowMode(true, false, false)).toBe('hidden');
  });

  it('dims every read story while read stories are shown', () => {
    expect(rowMode(true, true, true)).toBe('dimmed');
    expect(rowMode(true, false, true)).toBe('dimmed');
  });
});
