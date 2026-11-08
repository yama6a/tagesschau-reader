import { el } from './dom';
import { CATEGORIES, DEFAULT_SETTINGS, STATES, hasSelection, type Settings } from './settings';

let dialog: HTMLDialogElement;
let form: HTMLFormElement;
let done: HTMLButtonElement;
let required = false;
let onSave: (settings: Settings) => void = () => {};

function checkbox(name: string, value: string, label: string): HTMLElement {
  return el('label', {}, el('input', { type: 'checkbox', name, value }), label);
}

export function initOnboarding(node: HTMLDialogElement, save: (settings: Settings) => void): void {
  dialog = node;
  onSave = save;
  done = el('button', { type: 'submit', class: 'primary' }, 'Fertig');
  form = el(
    'form',
    {},
    el(
      'fieldset',
      {},
      el('legend', {}, 'Kategorien'),
      ...CATEGORIES.map((c) => checkbox('category', c.id, c.label)),
    ),
    el(
      'fieldset',
      {},
      el('legend', {}, 'Bundesländer'),
      ...STATES.map((name, i) => checkbox('region', String(i + 1), name)),
    ),
    done,
  );
  dialog.append(form);

  form.addEventListener('change', () => {
    done.disabled = !hasSelection(selected());
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const settings = selected();
    if (!hasSelection(settings)) {
      return;
    }
    dialog.close();
    onSave(settings);
  });
  // Without saved settings there is no list to go back to.
  dialog.addEventListener('cancel', (e) => {
    if (required) {
      e.preventDefault();
    }
  });
}

function selected(): Settings {
  const values = (name: string) =>
    [...form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)].map(
      (i) => i.value,
    );
  return {
    categories: values('category') as Settings['categories'],
    regions: values('region').map(Number),
  };
}

export function openOnboarding(current: Settings | undefined): void {
  required = current === undefined;
  const settings = current ?? DEFAULT_SETTINGS;
  for (const input of form.querySelectorAll<HTMLInputElement>('input')) {
    input.checked =
      input.name === 'category'
        ? settings.categories.some((c) => c === input.value)
        : settings.regions.includes(Number(input.value));
  }
  done.disabled = !hasSelection(settings);
  dialog.showModal();
}
