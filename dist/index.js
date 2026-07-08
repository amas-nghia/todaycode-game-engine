// src/vec2.ts
var UNIT = 1e3;
function tile(x, y) {
  return { x: x * UNIT, y: y * UNIT };
}
function add(v, o) {
  return { x: v.x + o.x, y: v.y + o.y };
}
function sub(v, o) {
  return { x: v.x - o.x, y: v.y - o.y };
}
function scale(v, n) {
  return { x: v.x * n, y: v.y * n };
}
function len2(v) {
  return v.x * v.x + v.y * v.y;
}
function len(v) {
  return isqrt(len2(v));
}
function moveToward(v, target, maxStep) {
  if (maxStep <= 0) {
    return v;
  }
  const delta = sub(target, v);
  const dist = isqrt(len2(delta));
  if (dist === 0 || dist <= maxStep) {
    return target;
  }
  return {
    x: v.x + Math.trunc(delta.x * maxStep / dist),
    y: v.y + Math.trunc(delta.y * maxStep / dist)
  };
}
function isqrt(n) {
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

// src/rng.ts
var GOLDEN_GAMMA = 0x9e3779b97f4a7c15n;
var MIX1 = 0xbf58476d1ce4e5b9n;
var MIX2 = 0x94d049bb133111ebn;
var MASK64 = (1n << 64n) - 1n;
var RNG = class {
  state;
  /**
   * Go seeds with `uint64(seed)` where `seed` is `int64` — for a negative
   * seed this is a two's-complement reinterpretation. `BigInt.asUintN(64, ...)`
   * replicates that wrap for negative bigints exactly.
   */
  constructor(seed) {
    this.state = BigInt.asUintN(64, BigInt(seed));
  }
  next() {
    this.state = BigInt.asUintN(64, this.state + GOLDEN_GAMMA);
    let z = this.state;
    z = BigInt.asUintN(64, BigInt.asUintN(64, z ^ z >> 30n) * MIX1);
    z = BigInt.asUintN(64, BigInt.asUintN(64, z ^ z >> 27n) * MIX2);
    return BigInt.asUintN(64, z ^ z >> 31n);
  }
  /**
   * Returns a value in [0, n) using rejection sampling (no modulo bias).
   * Bounded by `n`, so the return value is a plain `number` (safe: `n` is a
   * small int by contract). Throws (not "panics") when `n <= 0`.
   */
  intN(n) {
    if (n <= 0) {
      throw new Error(`rng: intN called with non-positive n=${n}`);
    }
    const un = BigInt(n);
    const limit = MASK64 - MASK64 % un;
    for (; ; ) {
      const v = this.next();
      if (v <= limit) {
        return Number(v % un);
      }
    }
  }
};

// src/replay.ts
function toOutcomeJSON(outcome) {
  const json = { over: outcome.over };
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
function toReplayJSON(replay) {
  return {
    engine: replay.engine,
    engineVersion: replay.engineVersion,
    levelSlug: replay.levelSlug,
    levelVersion: replay.levelVersion,
    seed: replay.seed,
    frameCount: replay.frameCount,
    frames: replay.frames.map((f) => ({ frame: f.frame, events: f.events })),
    outcome: toOutcomeJSON(replay.outcome)
  };
}

// src/frame-driver.ts
var DEFAULT_MAX_FRAMES = 3600;
function withMaxFrames(n) {
  return (config) => {
    if (n > 0) {
      config.maxFrames = n;
    }
  };
}
function withDecisionInterval(n) {
  return (config) => {
    if (n >= 0) {
      config.decisionInterval = n;
    }
  };
}
var FrameDriver = class {
  maxFrames;
  decisionInterval;
  constructor(...opts) {
    const config = {
      maxFrames: DEFAULT_MAX_FRAMES,
      decisionInterval: 0
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
  run(engine, level, seed, commanders) {
    let state;
    try {
      state = engine.init(level, seed);
    } catch (err) {
      throw new Error(`engine init: ${err.message}`);
    }
    const agentIds = Array.from(commanders.keys()).sort((a, b) => a - b);
    const frames = [];
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
              `agent ${id} decide at frame ${frame}: ${err.message}`
            );
          }
          try {
            state = engine.applyOrders(state, id, orders);
          } catch (err) {
            throw new Error(
              `agent ${id} apply orders at frame ${frame}: ${err.message}`
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
          `engine tick at frame ${frame}: ${err.message}`
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
      outcome: engine.result(state)
    };
  }
  isDecisionPoint(frame) {
    if (frame === 0) {
      return true;
    }
    if (this.decisionInterval <= 0) {
      return false;
    }
    return frame % this.decisionInterval === 0;
  }
};
export {
  DEFAULT_MAX_FRAMES,
  FrameDriver,
  RNG,
  UNIT,
  add,
  isqrt,
  len,
  len2,
  moveToward,
  scale,
  sub,
  tile,
  toOutcomeJSON,
  toReplayJSON,
  withDecisionInterval,
  withMaxFrames
};
//# sourceMappingURL=index.js.map