import { a as Event, O as Outcome, E as Engine, L as LevelDef, C as Commander } from './gamecore.interface-B670b_Xv.cjs';
export { G as Grader, b as LevelValidator, c as Order, S as Solvable, d as State } from './gamecore.interface-B670b_Xv.cjs';

/**
 * Fixed-point 2D vector math in milli-units. Never use floats in simulation
 * state — see libs/gamecore/README.md for the full determinism rationale.
 *
 * Every function here returns a NEW Vec2 and never mutates its inputs, per
 * this repo's immutability convention.
 */
/** One "tile" unit, expressed in milli-units. */
declare const UNIT = 1000;
interface Vec2 {
    readonly x: number;
    readonly y: number;
}
declare function tile(x: number, y: number): Vec2;
declare function add(v: Vec2, o: Vec2): Vec2;
declare function sub(v: Vec2, o: Vec2): Vec2;
declare function scale(v: Vec2, n: number): Vec2;
declare function len2(v: Vec2): number;
declare function len(v: Vec2): number;
/**
 * Moves `v` toward `target` by at most `maxStep` milli-units, snapping onto
 * the target if it is within `maxStep`. Returns `v` unchanged if `maxStep <= 0`.
 *
 * CRITICAL: the Go source computes `delta.X*maxStep/dist` using Go's `/`,
 * which truncates toward zero (NOT floor) — e.g. Go's `-7/2 == -3`, whereas
 * `Math.floor(-7/2) === -4`. `delta.x`/`delta.y` can be negative (target to
 * the left/above `v`), so this MUST use `Math.trunc`, never `Math.floor`.
 */
declare function moveToward(v: Vec2, target: Vec2, maxStep: number): Vec2;
/**
 * Integer square root (floor), matching the Go implementation's Newton's
 * method loop bit-for-bit. Every division here uses `Math.trunc` uniformly
 * (even though `n`/`x` are always positive after the guard below, so
 * `trunc === floor` in practice) so the pattern stays consistent and
 * defensively correct if this function is ever reused elsewhere.
 */
declare function isqrt(n: number): number;

/**
 * Deterministic splitmix64 RNG — port of pkg/gamecore/rng.go.
 *
 * CRITICAL: raw splitmix64 outputs are full 64-bit values that routinely
 * exceed Number.MAX_SAFE_INTEGER (2^53-1 ~= 9.007e15) — e.g. seed=1's first
 * output is 10451216379200822465. `next()` therefore returns `bigint`, not
 * `number`. Every intermediate `+`/`^`/`*` is masked to 64 bits with
 * `BigInt.asUintN(64, ...)` to replicate Go's silent uint64 wraparound.
 */
declare class RNG {
    private state;
    /**
     * Go seeds with `uint64(seed)` where `seed` is `int64` — for a negative
     * seed this is a two's-complement reinterpretation. `BigInt.asUintN(64, ...)`
     * replicates that wrap for negative bigints exactly.
     */
    constructor(seed: number | bigint);
    next(): bigint;
    /**
     * Returns a value in [0, n) using rejection sampling (no modulo bias).
     * Bounded by `n`, so the return value is a plain `number` (safe: `n` is a
     * small int by contract). Throws (not "panics") when `n <= 0`.
     */
    intN(n: number): number;
}

/**
 * Replay envelope — port of pkg/gamecore/replay.go.
 */

interface FrameEvents {
    frame: number;
    events: Event[];
}
interface Replay {
    engine: string;
    engineVersion: string;
    levelSlug: string;
    levelVersion: number;
    seed: number;
    frameCount: number;
    frames: FrameEvents[];
    outcome: Outcome;
}
/**
 * Serializes an Outcome replicating Go's `omitempty` exactly:
 *  - `over` always present.
 *  - `passed` omitted when `false` (present only when `true`).
 *  - `stars` omitted when `0`.
 *  - `winner` omitted when `0`.
 *  - `scores`/`metrics` omitted when undefined OR when they have zero own
 *    keys — Go's `omitempty` on a map is map-level (zero-length == nil), NOT
 *    per-entry. A non-empty map keeps ALL its keys even if some values are 0.
 */
declare function toOutcomeJSON(outcome: Outcome): Record<string, unknown>;
declare function toReplayJSON(replay: Replay): Record<string, unknown>;

/**
 * FrameDriver — port of pkg/gamecore/frame_driver.go.
 *
 * Drives one match to completion: at each decision point, visits every
 * commander (in ascending numeric agent-id order) to collect orders, applies
 * them to the engine, then ticks the engine once. Pure orchestration — no DB,
 * no I/O, no cancellation context (dropped; see port notes below).
 */

declare const DEFAULT_MAX_FRAMES = 3600;
interface FrameDriverConfig {
    maxFrames: number;
    decisionInterval: number;
}
type FrameDriverOption = (config: FrameDriverConfig) => void;
declare function withMaxFrames(n: number): FrameDriverOption;
declare function withDecisionInterval(n: number): FrameDriverOption;
declare class FrameDriver {
    private readonly maxFrames;
    private readonly decisionInterval;
    constructor(...opts: FrameDriverOption[]);
    /**
     * Runs one match to completion (or until maxFrames is reached).
     *
     * Note: the Go signature also takes a `context.Context` for cancellation.
     * There is no idiomatic TS equivalent worth forcing into a synchronous,
     * pure driver, so it is omitted entirely rather than half-ported.
     */
    run(engine: Engine, level: LevelDef, seed: number, commanders: Map<number, Commander>): Replay;
    private isDecisionPoint;
}

export { Commander, DEFAULT_MAX_FRAMES, Engine, Event, FrameDriver, type FrameDriverOption, type FrameEvents, LevelDef, Outcome, RNG, type Replay, UNIT, type Vec2, add, isqrt, len, len2, moveToward, scale, sub, tile, toOutcomeJSON, toReplayJSON, withDecisionInterval, withMaxFrames };
