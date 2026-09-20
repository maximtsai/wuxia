/** Two rigid bones, with angles measured clockwise from downward. */
export function solveLeg(x: number, y: number, upper: number, lower: number) {
  const distance = Math.max(
    Math.abs(upper - lower) + 0.001,
    Math.min(Math.hypot(x, y), upper + lower - 0.001),
  );
  const direction = Math.atan2(-x, y);
  const bend = Math.acos(
    Math.max(
      -1,
      Math.min(
        1,
        (upper * upper + distance * distance - lower * lower) /
          (2 * upper * distance),
      ),
    ),
  );
  const knee =
    Math.PI -
    Math.acos(
      Math.max(
        -1,
        Math.min(
          1,
          (upper * upper + lower * lower - distance * distance) /
            (2 * upper * lower),
        ),
      ),
    );
  return {
    thigh: ((direction - bend) * 180) / Math.PI,
    shin: (knee * 180) / Math.PI,
  };
}
export const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};
