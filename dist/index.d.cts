/**
 * Level definition contract — port of pkg/gamecore/level.go.
 *
 * No golden fixture exercises LevelDef directly, so `unknown` for the opaque
 * `definition`/`grading` payloads is sufficient — no need to preserve
 * raw-byte fidelity like Go's `json.RawMessage`.
 */
interface LevelDef {
    slug: string;
    version: number;
    gameSlug: string;
    definition: unknown;
    grading?: unknown;
}
/** Throws instead of returning a Go-style error. */
interface LevelValidator {
    validateLevel(definition: unknown): void;
}

/**
 * pkg/gamecore contract, ported to TypeScript.
 *
 * Determinism contract (mirrors the Go package doc):
 *  - Given the same (engineVersion, levelVersion, seed, inputs), an Engine MUST
 *    produce identical events[] and outcome, every time, on every platform.
 *  - No wall-clock, no DB access, no I/O, no process/container spawning inside
 *    gamecore or any Engine implementation. Untrusted user code never runs here
 *    — it only runs inside a domain's runner/sandbox.
 *  - All simulation state uses integers (see vec2.ts, UNIT milli-units) —
 *    never floats — and all randomness is drawn from the single seeded RNG
 *    stream (rng.ts), in a fixed, non-Map-iteration order.
 */
/** Opaque simulation state — engines cast internally, the driver never inspects it. */
type State = unknown;
/** Opaque per-tick event — consumers replay these; the driver never inspects them. */
type Event = unknown;
/** Opaque per-agent order/command — engines interpret these; the driver never inspects them. */
type Order = unknown;
/**
 * Outcome of a match/level attempt.
 *
 * `scores` and `metrics` are `Record<string, number>` even though the Go side's
 * `Scores` is `map[int]int64` — encoding/json marshals integer map keys as
 * quoted decimal strings, so the JSON shape (and thus what TS consumers
 * actually see over the wire) is string-keyed for both maps.
 */
interface Outcome {
    over: boolean;
    passed?: boolean;
    stars?: number;
    winner?: number;
    scores?: Record<string, number>;
    metrics?: Record<string, number>;
}

/**
 * Game rules. Pure & deterministic — see the module doc comment above.
 *
 * Go's `(value, error)` return convention becomes idiomatic TS: methods return
 * the value directly and throw on failure.
 */
interface Engine {
    name(): string;
    version(): string;
    init(level: LevelDef, seed: number): State;
    applyOrders(state: State, agentId: number, orders: Order[]): State;
    tick(state: State, frame: number): {
        state: State;
        events: Event[];
    };
    isOver(state: State): boolean;
    result(state: State): Outcome;
}
/** Decision layer: produces orders for one agent at one frame. */
interface Commander {
    decide(state: State, agentId: number, frame: number): Order[];
}
/** Optional capability: grade a final state against the level definition. */
interface Grader {
    grade(final: State, level: LevelDef): Outcome;
}
/** Optional capability: compute (or estimate) the optimal solution for a level. */
interface Solvable {
    solve(level: LevelDef): {
        optimalSteps: number;
        ok: boolean;
    };
}

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

export { type Commander, DEFAULT_MAX_FRAMES, type Engine, type Event, FrameDriver, type FrameDriverOption, type FrameEvents, type Grader, type LevelDef, type LevelValidator, type Order, type Outcome, RNG, type Replay, type Solvable, type State, UNIT, type Vec2, add, isqrt, len, len2, moveToward, scale, sub, tile, toOutcomeJSON, toReplayJSON, withDecisionInterval, withMaxFrames };
