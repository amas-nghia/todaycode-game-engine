/**
 * Replay envelope — port of pkg/gamecore/replay.go.
 */
import type { Event, Outcome } from './gamecore.interface';
import { WorldState } from './world';
import { getComponent } from './entity';
import { PositionComponent, HealthComponent, CollectibleComponent } from './components';

export interface FrameEvents {
  frame: number;
  events: Event[];
}

export interface WorldFrame {
  frame: number;
  tracked: Record<string, {
    position?: { x: number; y: number };
    health?: { current: number; max: number };
    alive?: boolean;
    collected?: boolean;
  }>;
  events: Event[];
}

export function captureWorldFrame(world: WorldState, frame: number, events: Event[]): WorldFrame {
  const tracked: Record<string, any> = {};
  
  for (const id of world.order) {
    const entity = world.entities[id];
    const pos = getComponent<PositionComponent>(entity, 'position');
    const health = getComponent<HealthComponent>(entity, 'health');
    const collectible = getComponent<CollectibleComponent>(entity, 'collectible');
    
    if (pos || health || collectible) {
      tracked[id] = {};
      if (pos) tracked[id].position = { x: pos.x, y: pos.y };
      if (health) {
        tracked[id].health = { current: health.current, max: health.max };
        tracked[id].alive = health.current > 0;
      }
      if (collectible) {
        tracked[id].collected = !!collectible.collectedBy;
      }
    }
  }
  
  return { frame, tracked, events };
}

export interface Replay {
  engine: string;
  engineVersion: string;
  levelSlug: string;
  levelVersion: number;
  seed: number;
  frameCount: number;
  frames: FrameEvents[];
  worldFrames?: WorldFrame[];
  outcome: Outcome;
  schemaVersion?: number;
  config?: Record<string, unknown>;
  meta?: Record<string, unknown>;
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
  const json: Record<string, unknown> = {
    engine: replay.engine,
    engineVersion: replay.engineVersion,
    levelSlug: replay.levelSlug,
    levelVersion: replay.levelVersion,
    seed: replay.seed,
    frameCount: replay.frameCount,
    frames: replay.frames.map((f) => ({ frame: f.frame, events: f.events })),
    outcome: toOutcomeJSON(replay.outcome),
  };

  if (replay.worldFrames) {
    json.worldFrames = replay.worldFrames.map(wf => ({
      frame: wf.frame,
      tracked: wf.tracked,
      events: wf.events,
    }));
  }

  if (replay.schemaVersion !== undefined) json.schemaVersion = replay.schemaVersion;
  if (replay.config !== undefined) json.config = replay.config;
  if (replay.meta !== undefined) json.meta = replay.meta;

  return json;
}
