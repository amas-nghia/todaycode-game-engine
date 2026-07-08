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
export type State = unknown;

/** Opaque per-tick event — consumers replay these; the driver never inspects them. */
export type Event = unknown;

/** Opaque per-agent order/command — engines interpret these; the driver never inspects them. */
export type Order = unknown;

/**
 * Outcome of a match/level attempt.
 *
 * `scores` and `metrics` are `Record<string, number>` even though the Go side's
 * `Scores` is `map[int]int64` — encoding/json marshals integer map keys as
 * quoted decimal strings, so the JSON shape (and thus what TS consumers
 * actually see over the wire) is string-keyed for both maps.
 */
export interface Outcome {
  over: boolean;
  passed?: boolean;
  stars?: number;
  winner?: number;
  scores?: Record<string, number>;
  metrics?: Record<string, number>;
}

import type { LevelDef } from './level';

/**
 * Game rules. Pure & deterministic — see the module doc comment above.
 *
 * Go's `(value, error)` return convention becomes idiomatic TS: methods return
 * the value directly and throw on failure.
 */
export interface Engine {
  name(): string;
  version(): string;
  init(level: LevelDef, seed: number): State;
  applyOrders(state: State, agentId: number, orders: Order[]): State;
  tick(state: State, frame: number): { state: State; events: Event[] };
  isOver(state: State): boolean;
  result(state: State): Outcome;
}

/** Decision layer: produces orders for one agent at one frame. */
export interface Commander {
  decide(state: State, agentId: number, frame: number): Order[];
}

/** Optional capability: grade a final state against the level definition. */
export interface Grader {
  grade(final: State, level: LevelDef): Outcome;
}

/** Optional capability: compute (or estimate) the optimal solution for a level. */
export interface Solvable {
  solve(level: LevelDef): { optimalSteps: number; ok: boolean };
}
