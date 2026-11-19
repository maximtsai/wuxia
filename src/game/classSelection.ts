import { classes, skills, type ClassId } from '../content/phase2';
const portraits: Record<
  ClassId,
  { file: string; accent: string; role: string; description: string }
> = {
  warrior: {
    file: 'warrior',
    accent: '#eb836d',
    role: 'Strength and endurance',
    description: 'Hits hard and shrugs off blows. Strength drives your damage.',
  },
  caster: {
    file: 'caster',
    accent: '#bfe7fa',
    role: 'Qi techniques',
    description:
      'The largest Qi pool. Qi techniques do the damage, and Gather Qi keeps you going.',
  },
  shadow: {
    file: 'shadow',
    accent: '#edc65a',
    role: 'Speed and critical hits',
    description: 'Speed helps you act first and land critical strikes.',
  },
  balanced: {
    file: 'wanderer',
    accent: '#87c6a3',
    role: 'Even stats',
    description: 'Grows evenly, so any build works.',
  },
};
export function classSelection(
  notice: string,
  selected: ClassId | null = null,
) {
  const art = selected ? portraits[selected] : null;
  const c = selected ? classes[selected] : null;
  return `<div class="class-screen"><div class="class-heading"><h1>Choose your path</h1><button class="class-continue" data-command="load">Continue saved game ↗</button></div><div class="class-columns" role="group" aria-label="Choose a class">${(
    ['warrior', 'caster', 'shadow', 'balanced'] as ClassId[]
  )
    .map((id) => {
      const a = portraits[id];
      return `<button type="button" class="class-column" style="--class-accent:${a.accent}" data-command="preview-class" data-value="${id}" aria-label="Choose ${classes[id].name}" aria-pressed="${selected === id}"><img src="${import.meta.env.BASE_URL}images/classes/${a.file}-stick-wuxia.png" alt="" width="1024" height="1536"><span class="class-shade"></span><span class="class-check" aria-hidden="true">✓</span><span class="class-caption"><span class="class-name">${classes[id].name}</span><span class="class-tagline">${a.role}</span></span></button>`;
    })
    .join(
      '',
    )}</div><div class="class-decision" style="--class-accent:${art?.accent ?? '#bfe7fa'}"><div class="class-summary"><p id="class-description" aria-live="polite">${art ? art.description : 'Pick a class. All four share one skill tree.'}</p>${c ? `<details class="class-details"><summary>Starting details</summary><p>Life ${c.life} · Qi ${c.mana} · Strength ${c.strength} · Speed ${c.speed}<br>Starts with ${skills[c.starter].name}. All classes can explore the shared skill tree.</p></details>` : ''}</div><button class="class-begin" data-command="class" data-value="${selected ?? ''}" ${selected ? '' : 'disabled'}>Begin journey <span aria-hidden="true">→</span></button></div><p class="class-permanent">Your class can’t be changed later; stats and skills can.</p><p id="notice" role="status">${notice}</p></div>`;
}
