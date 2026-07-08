/**
 * FrameDriver — port of pkg/gamecore/frame_driver.go.
 *
 * Drives one match to completion: at each decision point, visits every
 * commander (in ascending numeric agent-id order) to collect orders, applies
 * them to the engine, then ticks the engine once. Pure orchestration — no DB,
 * no I/O, no cancellation context (dropped; see port notes below).
 */
import type { Commander, Engine } from './gamecore.interface';
import type { LevelDef } from './level';
import type { FrameEvents, Replay } from './replay';

export const DEFAULT_MAX_FRAMES = 3600;

interface FrameDriverConfig {
  maxFrames: number;
  decisionInterval: number;
}

export type FrameDriverOption = (config: FrameDriverConfig) => void;

export function withMaxFrames(n: number): FrameDriverOption {
  return (config) => {
    if (n > 0) {
      config.maxFrames = n;
    }
  };
}

export function withDecisionInterval(n: number): FrameDriverOption {
  return (config) => {
    if (n >= 0) {
      config.decisionInterval = n;
    }
  };
}

export class FrameDriver {
  private readonly maxFrames: number;
  private readonly decisionInterval: number;

  constructor(...opts: FrameDriverOption[]) {
    const config: FrameDriverConfig = {
      maxFrames: DEFAULT_MAX_FRAMES,
      decisionInterval: 0,
    };
    opts.forEach((opt) => opt(config));
    this.maxFrames = config.maxFrames;
    this.decisionInterval = config.decisionInterval;
  }

  /**
   * Runs one match to completion (or until maxFrames is reached).
   *
   * Note: the Go signature also takes a `context.Context` for cancellation.
   * There is no idiomatic TS equivalent worth forcing into a synchronous,
   * pure driver, so it is omitted entirely rather than half-ported.
   */
  run(
    engine: Engine,
    level: LevelDef,
    seed: number,
    commanders: Map<number, Commander>,
  ): Replay {
    let state: unknown;
    try {
      state = engine.init(level, seed);
    } catch (err) {
      throw new Error(`engine init: ${(err as Error).message}`);
    }

    // CRITICAL: numeric comparator, not the default lexicographic sort —
    // `[2, 10, 1].sort()` -> `[1, 10, 2]` would silently break agent-visit
    // ordering for any match with >= 10 agents.
    const agentIds = Array.from(commanders.keys()).sort((a, b) => a - b);

    const frames: FrameEvents[] = [];
    let frame = 0;

    for (; frame < this.maxFrames && !engine.isOver(state); frame++) {
      if (this.isDecisionPoint(frame)) {
        for (const id of agentIds) {
          const commander = commanders.get(id);
          if (!commander) {
            continue;
          }
          let orders;
          try {
            orders = commander.decide(state, id, frame);
          } catch (err) {
            throw new Error(
              `agent ${id} decide at frame ${frame}: ${(err as Error).message}`,
            );
          }
          try {
            state = engine.applyOrders(state, id, orders);
          } catch (err) {
            throw new Error(
              `agent ${id} apply orders at frame ${frame}: ${(err as Error).message}`,
            );
          }
        }
      }

      let events;
      try {
        const next = engine.tick(state, frame);
        state = next.state;
        events = next.events;
      } catch (err) {
        throw new Error(
          `engine tick at frame ${frame}: ${(err as Error).message}`,
        );
      }

      if (events.length > 0) {
        frames.push({ frame, events });
      }
    }

    return {
      engine: engine.name(),
      engineVersion: engine.version(),
      levelSlug: level.slug,
      levelVersion: level.version,
      seed,
      frameCount: frame,
      frames,
      outcome: engine.result(state),
    };
  }

  private isDecisionPoint(frame: number): boolean {
    if (frame === 0) {
      return true;
    }
    if (this.decisionInterval <= 0) {
      return false;
    }
    return frame % this.decisionInterval === 0;
  }
}
