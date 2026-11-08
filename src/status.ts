import { el } from './dom';

export function failure(retry: () => void): HTMLElement {
  const button = el('button', { type: 'button' }, 'Erneut versuchen');
  button.addEventListener('click', retry);
  return el(
    'div',
    { class: 'failure', role: 'alert' },
    el('p', {}, 'Laden fehlgeschlagen'),
    button,
  );
}
