/**
 * Replay envelope — port of pkg/gamecore/replay.go.
 */
import type { Event, Outcome } from './gamecore.interface';

export interface FrameEvents {
  frame: number;
  events: Event[];
}

export interface Replay {
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
export function toOutcomeJSON(outcome: Outcome): Record<string, unknown> {
  const json: Record<string, unknown> = { over: outcome.over };

  if (outcome.passed) {
    json.passed = outcome.passed;
  }
  if (outcome.stars) {
    json.stars = outcome.stars;
  }
  if (outcome.winner) {
    json.winner = outcome.winner;
  }
  if (outcome.scores && Object.keys(outcome.scores).length > 0) {
    json.scores = outcome.scores;
  }
  if (outcome.metrics && Object.keys(outcome.metrics).length > 0) {
    json.metrics = outcome.metrics;
  }

  return json;
}

export function toReplayJSON(replay: Replay): Record<string, unknown> {
  return {
    engine: replay.engine,
    engineVersion: replay.engineVersion,
    levelSlug: replay.levelSlug,
    levelVersion: replay.levelVersion,
    seed: replay.seed,
    frameCount: replay.frameCount,
    frames: replay.frames.map((f) => ({ frame: f.frame, events: f.events })),
    outcome: toOutcomeJSON(replay.outcome),
  };
}
