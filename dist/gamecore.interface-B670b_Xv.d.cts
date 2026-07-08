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

export type { Commander as C, Engine as E, Grader as G, LevelDef as L, Outcome as O, Solvable as S, Event as a, LevelValidator as b, Order as c, State as d };
