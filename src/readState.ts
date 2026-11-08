// readIds and unreadIds map a sophoraId to the story date. Every story dated at or before
// readBefore counts as read, unless unreadIds holds it.
export interface ReadState {
  readIds: Record<string, string>;
  unreadIds: Record<string, string>;
  readBefore: number;
}

export const KEEP_DAYS = 35;

interface Dated {
  sophoraId: string;
  date: string;
  time: number;
}

export function emptyReadState(): ReadState {
  return { readIds: {}, unreadIds: {}, readBefore: 0 };
}

export function isRead(state: ReadState, story: Dated): boolean {
  if (story.sophoraId in state.readIds) {
    return true;
  }
  return story.time <= state.readBefore && !(story.sophoraId in state.unreadIds);
}

export function markRead(state: ReadState, story: Dated): void {
  state.readIds[story.sophoraId] = story.date;
  delete state.unreadIds[story.sophoraId];
}

export function markUnread(state: ReadState, story: Dated): void {
  delete state.readIds[story.sophoraId];
  if (story.time <= state.readBefore) {
    state.unreadIds[story.sophoraId] = story.date;
  }
}

export function markAllRead(state: ReadState, now: number): void {
  state.readBefore = now;
  state.unreadIds = {};
}

export function prune(state: ReadState, now: number): void {
  const limit = now - KEEP_DAYS * 24 * 60 * 60 * 1000;
  for (const ids of [state.readIds, state.unreadIds]) {
    for (const [id, date] of Object.entries(ids)) {
      if (!(Date.parse(date) >= limit)) {
        delete ids[id];
      }
    }
  }
}

// Whether a page older than `oldestLoaded` can still hold a story to show. With readBefore set by
// "Alle als gelesen markieren", every older story counts as read, so paging on only downloads
// days the list hides.
export function olderMayShow(state: ReadState, oldestLoaded: number, showRead: boolean): boolean {
  if (showRead || oldestLoaded > state.readBefore) {
    return true;
  }
  return Object.values(state.unreadIds).some((date) => Date.parse(date) < oldestLoaded);
}

// unread: a full row. collapsed: a strip, for a story read since the page loaded. dimmed: a read
// story while "Gelesene anzeigen" is on. hidden: a story read before the page loaded.
export type RowMode = 'unread' | 'collapsed' | 'dimmed' | 'hidden';

export function rowMode(read: boolean, readSinceLoad: boolean, showRead: boolean): RowMode {
  if (!read) {
    return 'unread';
  }
  if (showRead) {
    return 'dimmed';
  }
  return readSinceLoad ? 'collapsed' : 'hidden';
}
