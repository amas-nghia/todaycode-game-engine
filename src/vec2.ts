/**
 * Fixed-point 2D vector math in milli-units. This is available for rulebooks
 * that need integer math; the newer continuous-space world kernel may use
 * JavaScript numbers for position and physics state.
 *
 * Every function here returns a NEW Vec2 and never mutates its inputs, per
 * this repo's immutability convention.
 */

/** One "tile" unit, expressed in milli-units. */
export const UNIT = 1000;

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export function tile(x: number, y: number): Vec2 {
  return { x: x * UNIT, y: y * UNIT };
}

export function add(v: Vec2, o: Vec2): Vec2 {
  return { x: v.x + o.x, y: v.y + o.y };
}

export function sub(v: Vec2, o: Vec2): Vec2 {
  return { x: v.x - o.x, y: v.y - o.y };
}

export function scale(v: Vec2, n: number): Vec2 {
  return { x: v.x * n, y: v.y * n };
}

export function len2(v: Vec2): number {
  return v.x * v.x + v.y * v.y;
}

export function len(v: Vec2): number {
  return isqrt(len2(v));
}

/**
 * Moves `v` toward `target` by at most `maxStep` milli-units, snapping onto
 * the target if it is within `maxStep`. Returns `v` unchanged if `maxStep <= 0`.
 *
 * CRITICAL: the Go source computes `delta.X*maxStep/dist` using Go's `/`,
 * which truncates toward zero (NOT floor) — e.g. Go's `-7/2 == -3`, whereas
 * `Math.floor(-7/2) === -4`. `delta.x`/`delta.y` can be negative (target to
 * the left/above `v`), so this MUST use `Math.trunc`, never `Math.floor`.
 */
export function moveToward(v: Vec2, target: Vec2, maxStep: number): Vec2 {
  if (maxStep <= 0) {
    return v;
  }
  const delta = sub(target, v);
  const dist = isqrt(len2(delta));
  if (dist === 0 || dist <= maxStep) {
    return target;
  }
  return {
    x: v.x + Math.trunc((delta.x * maxStep) / dist),
    y: v.y + Math.trunc((delta.y * maxStep) / dist),
  };
}

/**
 * Integer square root (floor), matching the Go implementation's Newton's
 * method loop bit-for-bit. Every division here uses `Math.trunc` uniformly
 * (even though `n`/`x` are always positive after the guard below, so
 * `trunc === floor` in practice) so the pattern stays consistent and
 * defensively correct if this function is ever reused elsewhere.
 */
export function isqrt(n: number): number {
  if (n <= 0) {
    return 0;
  }
  if (n < 4) {
    return 1;
  }
  let x = n;
  let y = Math.trunc((x + 1) / 2);
  while (y < x) {
    x = y;
    y = Math.trunc((x + Math.trunc(n / x)) / 2);
  }
  return x;
}
