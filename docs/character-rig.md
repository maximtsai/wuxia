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
legs against foot targets. `HIP_HEIGHT` leaves a soft (~30°) standing knee.
Walking alternates planted feet and lifted return steps, each arm swinging
opposite its own leg. The walking pelvis height is solved from the grounded
feet: stance legs hold ~20° of knee, and the leading leg straightens to ~10° at
heel strike, so the pelvis rises over mid-stance and drops through double
support without the IK ever clamping. Folded poses the two-bone solver cannot reach
(`meditate`: seated cross-legged) set `legs` angles directly instead. The
foot rolls: heel strike lands toe-up, flattens, then pivots over the ball at
toe-off, and the ankle lifts so the toe tip stays the contact point.

World stride phase follows actual distance, compensated for character scale:
one cycle per `cycleDistance(stride)` travelled. Driving it by anything else is
what makes feet skate, so that export is the single source of truth and
`tests/unit/rig.test.ts` asserts the planted foot sweeps exactly that far.
`stride` scales the step with speed, so slow travel takes small steps and fast
travel opens up to the legs' reach rather than only churning faster. Above
`MAX_CADENCE` the legs cannot keep up and the feet do skate. Above `RUN_ON`
(smoothed, with hysteresis down to `RUN_OFF`) the rig switches to `run`: each
foot is planted for only 35% of the cycle, so both are airborne twice per
cycle, the body is lowest at mid-stance and highest in flight, the heel kicks
up behind and the knee drives through. It advances one cycle per
`runCycleDistance`, so it does not skate either. At the world's normal travel
speed the player runs; the walk shows at slower speeds and in the workshop.
Turning around narrows the figure through side-on over `TURN_TIME` instead of
flipping in one frame. Room transitions do not count as steps. The workshop walks in place using elapsed time. Transitions
blend briefly; reduced motion holds a still mid-stride contact or idle pose and
suppresses accessory/effect motion.

`CharacterStage.ts` consumes combat events without changing combat or saves.
The renderer handles player, service NPC, enemies, and shadow ally. Each
`action-used` event arrives in the same batch as its `damage` and
`attack-avoided` events, so the stage groups them: the number of blows per
target is how many hits the skill really landed (including early stops), and
each target's flinch or block is scheduled for the moment that blow visibly
lands. A dying target falls after the last blow on its way, not before. Skills
map to motions in `actionMotions` (player skills by id, enemy intents by name,
falling back on the skill's kind); the mapping is presentation only.

`strikes.ts` holds the keyframed actions. Each blow is a cock pose snapping into
a hit pose; repeated blows follow `strikeTiming` (wind-up, interval, recovery),
so `contactTimes` and `impactTimes` say exactly when every blow lands and the
tests pin that. Melee (`attack` slash, `thrust`, `chop`) leaps to a stand-off
point short of the target (`dash`), strikes, and hops home (`retreat`); the
root travels in screen space while the contact shadow stays on the floor.
Repeated slashes alternate forehand and backhand. Ranged motions fire from
where they stand and land when the projectile arrives: `throw` spins blades,
`bolt` pushes a qi orb, `burst` slams a ground wave that reaches each target in
turn. The blade leaves a short fading trail through each blow. Arm channels
blend the short way round, so a chop from behind the head comes over the top.
Reduced motion strikes in place without the leap. NPC turns wait for the
exchange on screen to finish (`CharacterStage.busy`) before resolving, and the
player's actions wait with them. Combat resolves instantly, so the stage also
holds each fighter's displayed Life at its old value until the blow that takes
it lands (`pendingLife`); its clock advances by the same clamped step the rigs
use, so a number and its blow stay together even when frames run long.

Out of combat the scene triggers gestures: a baoquan `salute` when a
conversation opens or a delivery completes, a hand-out `purchase` for shops,
food and refills, and Recover or the monk's restore sits the player into
`meditate` for a moment. Seated and standing poses blend through explicit leg
angles so the knees fold instead of snapping. Moving cancels a gesture.

Every animation and movement advances on wall-clock seconds from
`core/time.ts`, so 30 fps plays at the same speed as the design target of 60:
poses, blends, blow timings, gait cadence, turns, the blade ribbon's lifetime
and the enemy-turn delay all take their step from `frameSeconds`. Gaits are
driven by distance travelled rather than time, so they hold at any rate. Below
`MIN_FRAME_RATE` (15) a frame counts as one frame's worth of time and the world
runs in slow motion instead of leaping, which is what keeps a stalled tab from
teleporting the player past a doorway or skipping a blow. Easing uses
`approach`, which is exponential, so ten small steps land where one big step
would.

`/?rigPreview=1&sheet=<motion>` (optionally `&hits=2`, `&dash=1`, `&step=66`)
lays one motion out at eight evenly spaced moments, frozen, for reviewing key
poses; `step` replays at a coarser frame time, and every frame should match the
default. The workshop buttons also include hit-count and dash toggles.

Weapon attacks, bottles and qi effects use simple procedural shapes. Facing mirrors the
skeleton; rear travel adds a headband knot to the same blank silhouette.

Portrait assets are in `public/images/classes/`:

- Warrior: `warrior-stick-wuxia.png`
- Cultivator: `caster-stick-wuxia.png`
- Windstep: `shadow-stick-wuxia.png`
- Wanderer: `wanderer-stick-wuxia.png`

Internal class IDs remain unchanged for save compatibility.
