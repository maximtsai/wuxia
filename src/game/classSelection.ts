import { classes, skills, type ClassId } from '../content/phase2';
const portraits: Record<
  ClassId,
  { file: string; accent: string; role: string; description: string }
> = {
  warrior: {
    file: 'warrior',
    accent: '#eb836d',
    role: 'Strength and endurance',
    description: 'No blow can move you, and nothing you strike rises again.',
  },
  caster: {
    file: 'caster',
    accent: '#bfe7fa',
    role: 'Qi techniques',
    description:
      'Your Qi strikes like a storm, and every enemy before you falls at once.',
  },
  shadow: {
    file: 'shadow',
    accent: '#edc65a',
    role: 'Speed and critical hits',
    description: 'You land three strikes before your enemy finishes a breath.',
  },
  balanced: {
    file: 'wanderer',
    accent: '#87c6a3',
    role: 'Even stats',
    description:
      'You carry the secrets of every school, and no enemy knows what to expect.',
  },
};
/**
 * Strengths and weaknesses against Wanderer's even stats, read from class data
 * so balance changes keep the card accurate.
 */
function traits(id: ClassId) {
  const base = classes.balanced,
    c = classes[id],
    stats = [
      ['strength', 'Strength'],
      ['speed', 'Speed'],
      ['life', 'Life'],
      ['mana', 'Qi'],
    ] as const;
  const up = stats.filter(([k]) => c[k] > base[k]),
    down = stats.filter(([k]) => c[k] < base[k]);
  const items = [
    ...(up.length || down.length
      ? [
          ...up.map(([, n]) => `<span class="trait up">+${n}</span>`),
          ...down.map(([, n]) => `<span class="trait down">−${n}</span>`),
        ]
      : ['<span class="trait">Even in every stat</span>']),
    `<span class="trait trait-start">Starts with ${skills[c.starter].name}</span>`,
  ];
  // --i staggers each item's pop-in.
  return `<span class="class-traits">${items
    .map((html, i) => html.replace('<span ', `<span style="--i:${i}" `))
    .join('')}</span>`;
}
export function classSelection(
  notice: string,
  selected: ClassId | null = null,
  hasSave = false,
  enter = false,
) {
  const art = selected ? portraits[selected] : null;
  return `<div class="class-screen${enter ? ' entering' : ''}"><div class="class-heading"><h1>Choose your path</h1>${hasSave ? '<button class="class-continue" data-command="load">Continue saved game ↗</button>' : ''}</div><div class="class-columns" role="group" aria-label="Choose a class">${(
    ['warrior', 'caster', 'shadow', 'balanced'] as ClassId[]
  )
    .map((id) => {
      const a = portraits[id];
      return `<button type="button" class="class-column" style="--class-accent:${a.accent};--n:${['warrior', 'caster', 'shadow', 'balanced'].indexOf(id)}" data-command="preview-class" data-value="${id}" aria-label="Choose ${classes[id].name}" aria-pressed="${selected === id}"><img src="${import.meta.env.BASE_URL}images/classes/${a.file}-stick-wuxia.png" alt="" width="1024" height="1536"><span class="class-shade"></span><span class="class-check" aria-hidden="true">✓</span><span class="class-caption"><span class="class-name">${classes[id].name}</span><span class="class-tagline">${a.role}</span><span class="class-traits-wrap" aria-hidden="${selected !== id}">${traits(id)}</span></span></button>`;
    })
    .join(
      '',
    )}</div><div class="class-decision"><p id="class-description" class="desc-in" aria-live="polite">${art ? art.description : 'Pick a class. All four share one skill tree.'}</p><button class="class-begin" data-command="class" data-value="${selected ?? ''}" ${selected ? '' : 'disabled'}>Begin journey</button></div><p id="notice" role="status">${notice}</p></div>`;
}

/**
 * Selects a class on the already-rendered screen without rebuilding it, so the
 * card, traits, description and button animate. Returns false when the screen
 * is not on the page (the caller then renders it normally).
 */
export function previewClassInPlace(root: HTMLElement, selected: ClassId) {
  const screen = root.querySelector('.class-screen');
  if (!screen) return false;
  for (const card of screen.querySelectorAll<HTMLElement>('.class-column')) {
    const on = card.dataset.value === selected;
    card.setAttribute('aria-pressed', String(on));
    card
      .querySelector('.class-traits-wrap')
      ?.setAttribute('aria-hidden', String(!on));
  }
  const description = screen.querySelector<HTMLElement>('#class-description');
  if (description) {
    description.textContent = portraits[selected].description;
    // Restart the fade so each new description eases in.
    description.classList.remove('desc-in');
    void description.offsetWidth;
    description.classList.add('desc-in');
  }
  const begin = screen.querySelector<HTMLButtonElement>('.class-begin');
  if (begin) {
    if (begin.disabled) begin.classList.add('ready');
    begin.disabled = false;
    begin.dataset.value = selected;
  }
  screen.classList.remove('entering');
  return true;
}
