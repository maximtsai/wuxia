/** Small inline resource icons; colour comes from CSS (`.ico-<kind>`). */
export type IconKind = 'life' | 'qi' | 'energy' | 'gold';

const paths: Record<IconKind, string> = {
  // Heart.
  life: '<path d="M12 21s-7.5-4.6-9.4-9.3C1.2 8.2 3.3 4.5 6.9 4.5c2.1 0 3.6 1.2 5.1 3 1.5-1.8 3-3 5.1-3 3.6 0 5.7 3.7 4.3 7.2C19.5 16.4 12 21 12 21z" fill="currentColor"/>',
  // Qi swirl: an orb with an inner curl.
  qi: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 6.5a5.5 5.5 0 1 1-5.2 7.3A3.3 3.3 0 0 0 12 12a3 3 0 0 0 0-5.5z" fill="currentColor"/>',
  // Lightning bolt.
  energy:
    '<path d="M13.5 2 4.5 13.5h6L9.5 22l10-12h-6.2z" fill="currentColor"/>',
  // Square-holed temple coin.
  gold: '<circle cx="12" cy="12" r="9.5" fill="currentColor"/><rect x="9" y="9" width="6" height="6" fill="#1e1710"/>',
};

export function icon(kind: IconKind, label?: string) {
  return `<svg class="ico ico-${kind}" viewBox="0 0 24 24" aria-hidden="true">${paths[kind]}</svg>${label ? `<span class="visually-hidden">${label}</span>` : ''}`;
}
