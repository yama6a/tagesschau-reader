export const CATEGORIES = [
  { id: 'inland', label: 'Inland' },
  { id: 'ausland', label: 'Ausland' },
  { id: 'wirtschaft', label: 'Wirtschaft' },
  { id: 'wissen', label: 'Wissen' },
  { id: 'investigativ', label: 'Investigativ' },
  { id: 'faktenfinder', label: 'Faktenfinder' },
  { id: 'weitere', label: 'Weitere' },
  { id: 'sport', label: 'Sport' },
] as const;

export type Category = (typeof CATEGORIES)[number]['id'];

// The API numbers the states 1 to 16 in this order. 0 means nationwide.
export const STATES = [
  'Baden-Württemberg',
  'Bayern',
  'Berlin',
  'Brandenburg',
  'Bremen',
  'Hamburg',
  'Hessen',
  'Mecklenburg-Vorpommern',
  'Niedersachsen',
  'Nordrhein-Westfalen',
  'Rheinland-Pfalz',
  'Saarland',
  'Sachsen',
  'Sachsen-Anhalt',
  'Schleswig-Holstein',
  'Thüringen',
] as const;

export interface Settings {
  categories: Category[];
  regions: number[];
}

export const DEFAULT_SETTINGS: Settings = {
  categories: [
    'inland',
    'ausland',
    'wirtschaft',
    'wissen',
    'investigativ',
    'faktenfinder',
    'weitere',
  ],
  regions: [],
};

export function hasSelection(settings: Settings): boolean {
  return settings.categories.length > 0 || settings.regions.length > 0;
}
