import { classes, skills, type ClassId } from '../content/phase2';
const portraits: Record<
  ClassId,
  { file: string; accent: string; role: string; description: string }
> = {
  balanced: {
    file: 'wanderer',
    accent: '#87c6a3',
    role: 'An unwritten path',
    description:
      'You were born with no specialty, but your potential is yours to shape. Even growth in every direction gives you the freedom to forge your own fighting style.',
  },
  warrior: {
    file: 'warrior',
    accent: '#eb836d',
    role: 'Strength & endurance',
    description:
      'Meet danger head-on. Strong physical attacks, sturdy defenses, and greater Life growth reward a direct, relentless fighting style.',
  },
  caster: {
    file: 'caster',
    accent: '#bfe7fa',
    role: 'Qi & inner cultivation',
    description:
      'Turn preparation into power. A deep Qi reserve and strong inner cultivation support palm techniques, recovery, and sustained qi attacks. Gather Qi is yours from the start.',
  },
  shadow: {
    file: 'shadow',
    accent: '#edc65a',
    role: 'Speed & precision',
    description:
      'Strike before your enemy can react. Speed-focused growth helps secure the opening turn and improves critical chance, while Lightfoot Steps sharpens your natural advantage.',
  },
};
export function classSelection(notice: string) {
  return `<div class="class-screen"><div class="class-heading"><span class="class-eyebrow">Before the journey</span><h1>Choose your path</h1><p>Your journey through the jianghu begins here.</p></div><div class="class-columns">${(
    ['warrior', 'caster', 'shadow', 'balanced'] as ClassId[]
  )
    .map((id, i) => {
      const c = classes[id],
        art = portraits[id];
      return `<article class="class-column" style="--class-accent:${art.accent}" tabindex="0" aria-label="${c.name} class preview" aria-describedby="class-tip-${id}"><img src="${import.meta.env.BASE_URL}images/classes/${art.file}-wuxia.png" alt="${c.name} character portrait" width="1024" height="1536"><div class="class-shade"></div><span class="class-number">0${i + 1}</span><div class="class-tooltip" id="class-tip-${id}" role="tooltip"><strong>${c.name}</strong><p>${art.description}</p><small>Life ${c.life} · Qi ${c.mana}<br>Strength ${c.strength} · Speed ${c.speed}<br>Starts with ${skills[c.starter].name}</small></div><div class="class-caption"><h2>${c.name}</h2><p>${art.role}</p><button data-command="class" data-value="${id}" aria-label="Choose ${c.name}">Choose ${c.name}<span aria-hidden="true"> ↗</span></button></div></article>`;
    })
    .join(
      '',
    )}</div><footer class="class-footer"><p>Hover or focus to discover a class. Tap a portrait on touch screens.<br>Your class is permanent. Stats and skills can be respecced later.</p><button data-command="load" data-value="">Load saved progress</button></footer><p id="notice" role="status">${notice}</p></div>`;
}
