import type { ReadState } from './readState';
import type { Settings } from './settings';

// Every key carries this prefix. Raise the version when a stored shape changes incompatibly.
const PREFIX = 'tagesschau-reader.v1.';

function read<T>(key: string): T | undefined {
  const raw = localStorage.getItem(PREFIX + key);
  if (raw === null) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown): void {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export function loadSettings(): Settings | undefined {
  const s = read<Settings>('settings');
  if (!s || !Array.isArray(s.categories) || !Array.isArray(s.regions)) {
    return undefined;
  }
  return s;
}

export function saveSettings(settings: Settings): void {
  write('settings', settings);
}

export function loadReadState(): ReadState {
  return {
    readIds: read<Record<string, string>>('readIds') ?? {},
    unreadIds: read<Record<string, string>>('unreadIds') ?? {},
    readBefore: read<number>('readBefore') ?? 0,
  };
}

export function saveReadState(state: ReadState): void {
  write('readIds', state.readIds);
  write('unreadIds', state.unreadIds);
  write('readBefore', state.readBefore);
}

export function loadShowRead(): boolean {
  return read<boolean>('showRead') ?? false;
}

export function saveShowRead(on: boolean): void {
  write('showRead', on);
}
