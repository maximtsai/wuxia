# Stick character animation

Open `/?rigPreview=1` to inspect all four palettes and idle, walk, attack, hit,
guard, drink, qi, and defeat animations against colored backgrounds.

`HumanoidRig.ts` draws connected thick strokes, round joints and hands, a blank
circular head, and colored headband/sash accents using Phaser Graphics. The
spine is hips -> chest -> shoulders -> neck, so the torso can curve, breathe and
counter-rotate instead of pivoting as one rigid bar. Near and far limbs hang
from their own hip and shoulder points, offset by a few units of depth plus the
pose's `twist`; three ink values (near limbs darkest, torso a step lighter, far
limbs lightest) keep an overlapping near arm readable. No generated textures or
external rig editor are required. The old `wuxia-parts.png` is retained as an
unused reference; gameplay and the workshop no longer load it.

`poses.ts` owns animation and class palettes. `kinematics.ts` solves fixed-length
legs against foot targets. `HIP_HEIGHT` sits high enough above the ground to
leave the knee bent at full stride, so the IK never clamps. Walking alternates
planted feet and lifted return steps, each arm swinging opposite its own leg,
with the pelvis rising over mid-stance and dropping through double support. The
foot rolls: heel strike lands toe-up, flattens, then pivots over the ball at
toe-off, and the ankle lifts so the toe tip stays the contact point.

World stride phase follows actual distance, compensated for character scale:
one cycle per `cycleDistance(stride)` travelled. Driving it by anything else is
what makes feet skate, so that export is the single source of truth and
`tests/unit/rig.test.ts` asserts the planted foot sweeps exactly that far.
`stride` scales the step with speed, so slow travel takes small steps and fast
travel opens up to the legs' reach rather than only churning faster. Above
`MAX_CADENCE` the legs cannot keep up and the feet do skate; a run gait with a
flight phase would be the fix if travel ever gets faster. Room transitions do
not count as steps. The workshop walks in place using elapsed time. Transitions
blend briefly; reduced motion holds a still mid-stride contact or idle pose and
suppresses accessory/effect motion.

`CharacterStage.ts` consumes combat events without changing combat or saves.
The renderer handles player, service NPC, enemies, and shadow ally. Weapon
attacks, bottles and qi effects use simple procedural shapes. Facing mirrors the
skeleton; rear travel adds a headband knot to the same blank silhouette.

Portrait assets are in `public/images/classes/`:

- Warrior: `warrior-stick-wuxia.png`
- Cultivator: `caster-stick-wuxia.png`
- Windstep: `shadow-stick-wuxia.png`
- Wanderer: `wanderer-stick-wuxia.png`

Internal class IDs remain unchanged for save compatibility.
