import {
  Commander,
  Engine,
  Event,
  Order,
  Outcome,
} from '../gamecore.interface';
import { LevelDef } from '../level';
import { Vec2, moveToward } from '../vec2';
import { FrameDriver, withMaxFrames } from '../frame-driver';

/**
 * Minimal single-agent "walk to the goal" test engine — scaffolding only,
 * ported from frame_driver_test.go's walkDef/walkState/walkEngine/
 * walkCommander. Lives here (not in library source) because it exists purely
 * to exercise FrameDriver.
 */
interface WalkDef {
  start: Vec2;
  goal: Vec2;
  speed: number;
}

interface WalkState {
  pos: Vec2;
  goal: Vec2;
  speed: number;
  reached: boolean;
}

class WalkEngine implements Engine {
  name(): string {
    return 'walk-test';
  }

  version(): string {
    return '1.0.0';
  }

  init(level: LevelDef): WalkState {
    const def = level.definition as WalkDef;
    return {
      pos: def.start,
      goal: def.goal,
      speed: def.speed,
      reached: def.start.x === def.goal.x && def.start.y === def.goal.y,
    };
  }

  applyOrders(state: unknown): WalkState {
    // No orders used by this test engine — return state unchanged.
    return state as WalkState;
  }

  tick(state: unknown): { state: WalkState; events: Event[] } {
    const s = state as WalkState;
    if (s.reached) {
      return { state: s, events: [] };
    }

    const nextPos = moveToward(s.pos, s.goal, s.speed);
    const events: Event[] = [{ type: 'MOVE', pos: nextPos }];
    const reached = nextPos.x === s.goal.x && nextPos.y === s.goal.y;
    if (reached) {
      events.push({ type: 'ARRIVE', waypoint: s.goal });
    }

    return {
      state: { ...s, pos: nextPos, reached },
      events,
    };
  }

  isOver(state: unknown): boolean {
    return (state as WalkState).reached;
  }

  result(state: unknown): Outcome {
    const s = state as WalkState;
    return {
      over: s.reached,
      passed: s.reached,
      stars: s.reached ? 3 : 0,
    };
  }
}

class WalkCommander implements Commander {
  decide(): Order[] {
    return [];
  }
}

function walkLevel(start: Vec2, goal: Vec2, speed: number): LevelDef {
  return {
    slug: 'walk-test-level',
    version: 1,
    gameSlug: 'walk',
    definition: { start, goal, speed } as WalkDef,
  };
}

describe('FrameDriver', () => {
  it('runs a single agent to the goal', () => {
    const driver = new FrameDriver();
    const engine = new WalkEngine();
    const level = walkLevel({ x: 0, y: 0 }, { x: 5000, y: 0 }, 66);
    const commanders = new Map<number, Commander>([[1, new WalkCommander()]]);

    const replay = driver.run(engine, level, 42, commanders);

    expect(replay.outcome.passed).toBe(true);
    expect(replay.outcome.stars).toBe(3);
    expect(replay.frameCount).toBeGreaterThan(0);
    expect(replay.frames.length).toBeGreaterThan(0);
    expect(replay.engine).toBe('walk-test');
    expect(replay.engineVersion).toBe('1.0.0');
  });

  it('is deterministic across repeated runs with the same seed', () => {
    const run = () => {
      const driver = new FrameDriver();
      const engine = new WalkEngine();
      const level = walkLevel({ x: 1000, y: 1000 }, { x: 9000, y: 4000 }, 50);
      const commanders = new Map<number, Commander>([[1, new WalkCommander()]]);
      return driver.run(engine, level, 7, commanders);
    };

    const first = run();
    const second = run();
    expect(second).toEqual(first);
  });

  it('caps at maxFrames when the agent never reaches the goal', () => {
    const driver = new FrameDriver(withMaxFrames(50));
    const engine = new WalkEngine();
    // speed 0 -> moveToward's maxStep<=0 guard means the agent never moves.
    const level = walkLevel({ x: 0, y: 0 }, { x: 5000, y: 0 }, 0);
    const commanders = new Map<number, Commander>([[1, new WalkCommander()]]);

    const replay = driver.run(engine, level, 1, commanders);

    expect(replay.frameCount).toBe(50);
    expect(replay.outcome.passed).toBe(false);
  });
});
