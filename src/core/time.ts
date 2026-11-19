/**
 * Animation and movement advance on wall-clock seconds, so they play out the
 * same at any frame rate: 60 fps is the design target, and a 30 fps machine
 * sees the same walk speed, the same blow timings and the same blends.
 *
 * Below this frame rate the game slows down instead of leaping forward. A
 * stalled tab or a long GC pause would otherwise teleport the player past a
 * doorway or skip a blow entirely, so an overlong frame counts as this long
 * and the world simply runs in slow motion until frames recover.
 */
export const MIN_FRAME_RATE = 15;
export const MAX_FRAME_SECONDS = 1 / MIN_FRAME_RATE;
/** Game-time seconds for a frame that took `delta` milliseconds. */
export const frameSeconds = (delta: number) =>
  Math.min(Math.max(delta, 0) / 1000, MAX_FRAME_SECONDS);
/**
 * How far to move toward a target this frame when easing at `rate` per second.
 * Exponential, so ten small steps land exactly where one big step would.
 */
export const approach = (dt: number, rate: number) => 1 - Math.exp(-rate * dt);
