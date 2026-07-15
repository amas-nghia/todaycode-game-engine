"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  ACTION_ATTACK: () => ACTION_ATTACK,
  ACTION_CAST: () => ACTION_CAST,
  ACTION_MOVE: () => ACTION_MOVE,
  ACTION_PICK_UP: () => ACTION_PICK_UP,
  ACTION_SAY: () => ACTION_SAY,
  ACTION_WAIT: () => ACTION_WAIT,
  ActionRunner: () => ActionRunner,
  AttackHandler: () => AttackHandler,
  DEFAULT_MAX_FRAMES: () => DEFAULT_MAX_FRAMES,
  FrameDriver: () => FrameDriver,
  LiveWorldSession: () => LiveWorldSession,
  MoveDirectionHandler: () => MoveDirectionHandler,
  MovementSystem: () => MovementSystem,
  MultiFrameActionRunner: () => MultiFrameActionRunner,
  ObjectiveSystem: () => ObjectiveSystem,
  PickUpHandler: () => PickUpHandler,
  PlanRunner: () => PlanRunner,
  RNG: () => RNG,
  SystemRunner: () => SystemRunner,
  UNIT: () => UNIT,
  WaitHandler: () => WaitHandler,
  WorldRunner: () => WorldRunner,
  YieldPlanRunner: () => YieldPlanRunner,
  add: () => add,
  addEntity: () => addEntity,
  buildReplay: () => buildReplay,
  captureWorldFrame: () => captureWorldFrame,
  createWorld: () => createWorld,
  distance: () => distance,
  findNearest: () => findNearest,
  getBlockingEntities: () => getBlockingEntities,
  getComponent: () => getComponent,
  getEntity: () => getEntity,
  hasComponent: () => hasComponent,
  isInBounds: () => isInBounds,
  isOccupied: () => isOccupied,
  isPathClear: () => isPathClear,
  isPositionInBounds: () => isPositionInBounds,
  isSegmentClear: () => isSegmentClear,
  isqrt: () => isqrt,
  len: () => len,
  len2: () => len2,
  moveToward: () => moveToward,
  removeComponent: () => removeComponent,
  removeEntity: () => removeEntity,
  scale: () => scale,
  setComponent: () => setComponent,
  sub: () => sub,
  tile: () => tile,
  toOutcomeJSON: () => toOutcomeJSON,
  toReplayJSON: () => toReplayJSON,
  updateEntity: () => updateEntity,
  visibleEntities: () => visibleEntities,
  withComponent: () => withComponent,
  withDecisionInterval: () => withDecisionInterval,
  withMaxFrames: () => withMaxFrames,
  withoutComponent: () => withoutComponent
});
module.exports = __toCommonJS(src_exports);

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

// src/entity.ts
function getComponent(entity, component) {
  return entity.components[component];
}
function hasComponent(entity, component) {
  return entity.components[component] !== void 0;
}
function setComponent(entity, component, data) {
  entity.components[component] = data;
}
function removeComponent(entity, component) {
  delete entity.components[component];
}
function withComponent(entity, component, data) {
  return {
    ...entity,
    components: {
      ...entity.components,
      [component]: data
    }
  };
}
function withoutComponent(entity, component) {
  const newComponents = { ...entity.components };
  delete newComponents[component];
  return {
    ...entity,
    components: newComponents
  };
}

// src/replay.ts
function captureWorldFrame(world, frame, events) {
  const tracked = {};
  for (const id of world.order) {
    const entity = world.entities[id];
    const pos = getComponent(entity, "position");
    const health = getComponent(entity, "health");
    const collectible = getComponent(entity, "collectible");
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
  const json = {
    engine: replay.engine,
    engineVersion: replay.engineVersion,
    levelSlug: replay.levelSlug,
    levelVersion: replay.levelVersion,
    seed: replay.seed,
    frameCount: replay.frameCount,
    outcome: toOutcomeJSON(replay.outcome)
  };
  if (replay.frames) {
    json.frames = replay.frames.map((f) => ({ frame: f.frame, events: f.events }));
  }
  if (replay.worldFrames) {
    json.worldFrames = replay.worldFrames.map((wf) => ({
      frame: wf.frame,
      tracked: wf.tracked,
      events: wf.events
    }));
  }
  if (replay.schemaVersion !== void 0) json.schemaVersion = replay.schemaVersion;
  if (replay.config !== void 0) json.config = replay.config;
  if (replay.meta !== void 0) json.meta = replay.meta;
  return json;
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

// src/world.ts
function createWorld(seed, frame = 0) {
  return {
    frame,
    seed,
    entities: {},
    order: [],
    metrics: {}
  };
}
function addEntity(world, entity) {
  if (world.entities[entity.id]) {
    throw new Error(`Entity with id ${entity.id} already exists`);
  }
  world.entities[entity.id] = entity;
  world.order.push(entity.id);
}
function removeEntity(world, entityId) {
  if (!world.entities[entityId]) {
    return;
  }
  delete world.entities[entityId];
  const idx = world.order.indexOf(entityId);
  if (idx !== -1) {
    world.order.splice(idx, 1);
  }
}
function getEntity(world, entityId) {
  return world.entities[entityId];
}
function updateEntity(world, entity) {
  if (!world.entities[entity.id]) {
    throw new Error(`Entity with id ${entity.id} does not exist`);
  }
  world.entities[entity.id] = entity;
}

// src/actions.ts
var ACTION_MOVE = "MOVE";
var ACTION_ATTACK = "ATTACK";
var ACTION_PICK_UP = "PICK_UP";
var ACTION_CAST = "CAST";
var ACTION_SAY = "SAY";
var ACTION_WAIT = "WAIT";

// src/action-runner.ts
var ActionRunner = class {
  handlers = /* @__PURE__ */ new Map();
  registerHandler(handler) {
    this.handlers.set(handler.type, handler);
  }
  run(ctx, actions) {
    const events = [];
    for (const action of actions) {
      const handler = this.handlers.get(action.type);
      if (!handler) {
        events.push({
          type: "log",
          frame: ctx.frame,
          message: `Unknown action type: ${action.type}`
        });
        continue;
      }
      const validation = handler.validate(ctx, action);
      if (!validation.valid) {
        events.push({
          type: "log",
          frame: ctx.frame,
          message: `Action invalid: ${validation.reason}`
        });
        continue;
      }
      const result = handler.apply(ctx, action);
      events.push(...result.events);
    }
    return events;
  }
};

// src/multi-frame-action.ts
var MultiFrameActionRunner = class {
  handlers = /* @__PURE__ */ new Map();
  registerHandler(handler) {
    this.handlers.set(handler.type, handler);
  }
  start(ctx, action) {
    const handler = this.handlers.get(action.type);
    if (!handler) {
      return {
        state: { action, startedFrame: ctx.frame, updatedFrame: ctx.frame, status: "failed", failureReason: `Unknown action type: ${action.type}` },
        events: [{
          type: "log",
          frame: ctx.frame,
          message: `Unknown action type: ${action.type}`
        }]
      };
    }
    const validation = handler.validate(ctx, action);
    if (!validation.valid) {
      return {
        state: { action, startedFrame: ctx.frame, updatedFrame: ctx.frame, status: "failed", failureReason: `Action invalid: ${validation.reason}` },
        events: [{
          type: "log",
          frame: ctx.frame,
          message: `Action invalid: ${validation.reason}`
        }]
      };
    }
    const started = handler.start?.(ctx, action);
    const state = {
      action,
      startedFrame: ctx.frame,
      updatedFrame: ctx.frame,
      status: "running",
      localState: started?.localState
    };
    return { state, events: started?.events ?? [] };
  }
  tick(ctx, state) {
    if (!state) return { state: null, events: [] };
    if (state.status !== "running") return { state: null, events: [] };
    const handler = this.handlers.get(state.action.type);
    if (!handler) {
      return {
        state: null,
        events: [{
          type: "log",
          frame: ctx.frame,
          message: `Unknown action type: ${state.action.type}`
        }]
      };
    }
    const result = handler.step(ctx, state);
    const nextState = {
      ...state,
      updatedFrame: ctx.frame,
      status: result.status,
      localState: result.localState,
      failureReason: result.failureReason
    };
    const events = [...result.events];
    return {
      state: nextState,
      events
    };
  }
};

// src/plan-runner.ts
var PlanRunner = class {
  constructor(actions, options = {}) {
    this.actions = actions;
    this.options = options;
  }
  actions;
  options;
  createState(actions) {
    return {
      queue: actions.map((action) => ({ action })),
      current: null,
      completed: 0,
      failed: false
    };
  }
  tick(ctx, state) {
    if (state.failed) {
      return { state, events: [], done: true };
    }
    const events = [];
    let current = state.current;
    let queue = state.queue;
    let completed = state.completed;
    let failed = state.failed;
    let failureReason = state.failureReason;
    if (!current && queue.length > 0) {
      const nextStep = queue[0];
      queue = queue.slice(1);
      const started = this.actions.start(ctx, nextStep.action);
      events.push(...started.events);
      if (started.state && started.state.status === "running") {
        current = started.state;
      } else {
        if (started.state?.status === "failed") {
          failed = this.options.stopOnFailure ?? true;
          failureReason = started.state.failureReason;
        } else if (started.state?.status === "done") {
          completed += 1;
        }
        current = null;
      }
    }
    if (current) {
      const ticked = this.actions.tick(ctx, current);
      events.push(...ticked.events);
      if (ticked.state && ticked.state.status === "running") {
        current = ticked.state;
      } else {
        if (ticked.state?.status === "failed") {
          failed = this.options.stopOnFailure ?? true;
          failureReason = ticked.state.failureReason;
        } else if (ticked.state?.status === "done") {
          completed += 1;
        }
        current = null;
      }
    }
    const nextState = {
      queue,
      current,
      completed,
      failed,
      failureReason
    };
    return {
      state: nextState,
      events,
      done: failed || !current && queue.length === 0
    };
  }
};
var YieldPlanRunner = class {
  constructor(actions, plan, options = {}) {
    this.actions = actions;
    this.plan = plan;
    this.options = options;
  }
  actions;
  plan;
  options;
  createState() {
    return {
      current: null,
      completed: 0,
      failed: false,
      done: false
    };
  }
  tick(ctx, state) {
    if (state.failed || state.done) {
      return { state, events: [], done: true };
    }
    const events = [];
    let current = state.current;
    let completed = state.completed;
    let failed = state.failed;
    let done = state.done;
    let failureReason = state.failureReason;
    let lastResult = state.lastResult;
    const wasIdle = !current;
    if (current) {
      const ticked = this.actions.tick(ctx, current);
      events.push(...ticked.events);
      lastResult = ticked;
      if (ticked.state && ticked.state.status === "running") {
        current = ticked.state;
      } else {
        if (ticked.state?.status === "failed") {
          failed = this.options.stopOnFailure ?? true;
          failureReason = ticked.state.failureReason;
        } else if (ticked.state?.status === "done") {
          completed += 1;
        }
        current = null;
      }
    }
    if (wasIdle && !failed && !done) {
      const yielded = this.plan.next(lastResult);
      done = Boolean(yielded.done);
      if (!done && yielded.value) {
        const started = this.actions.start(ctx, yielded.value);
        events.push(...started.events);
        if (started.state && started.state.status === "running") {
          current = started.state;
        } else {
          if (started.state?.status === "failed") {
            failed = this.options.stopOnFailure ?? true;
            failureReason = started.state.failureReason;
          } else if (started.state?.status === "done") {
            completed += 1;
          }
          current = null;
        }
        if (current) {
          const ticked = this.actions.tick(ctx, current);
          events.push(...ticked.events);
          lastResult = ticked;
          if (ticked.state && ticked.state.status === "running") {
            current = ticked.state;
          } else {
            if (ticked.state?.status === "failed") {
              failed = this.options.stopOnFailure ?? true;
              failureReason = ticked.state.failureReason;
            } else if (ticked.state?.status === "done") {
              completed += 1;
            }
            current = null;
          }
        }
      }
    }
    const nextState = {
      current,
      completed,
      failed,
      done,
      failureReason,
      lastResult
    };
    return {
      state: nextState,
      events,
      done: failed || done
    };
  }
};

// src/physics.ts
function distance(a, b) {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}
function isPositionInBounds(world, pos, radius = 0) {
  if (!world.bounds) return true;
  const { minX, maxX, minY, maxY } = world.bounds;
  return pos.x - radius >= minX && pos.x + radius <= maxX && pos.y - radius >= minY && pos.y + radius <= maxY;
}
function getBlockingEntities(world) {
  const blockers = [];
  for (const id of world.order) {
    const entity = world.entities[id];
    const block = getComponent(entity, "blocking");
    const pos = getComponent(entity, "position");
    const col = getComponent(entity, "collision");
    const health = getComponent(entity, "health");
    if (block?.blocksMovement && pos && col) {
      if (health && health.current <= 0) {
        continue;
      }
      blockers.push({
        id,
        x: pos.x,
        y: pos.y,
        radius: col.radius
      });
    }
  }
  return blockers;
}
function distancePointToSegment(px, py, x1, y1, x2, y2) {
  const l2 = Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2);
  if (l2 === 0) return distance({ x: px, y: py }, { x: x1, y: y1 });
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);
  return distance({ x: px, y: py }, { x: projX, y: projY });
}
function isSegmentClear(world, from, to, actorId, actorRadius = 0) {
  const blockers = getBlockingEntities(world);
  for (const b of blockers) {
    if (actorId && b.id === actorId) continue;
    const dist = distancePointToSegment(b.x, b.y, from.x, from.y, to.x, to.y);
    if (dist < b.radius + actorRadius) {
      return false;
    }
  }
  return true;
}

// src/selectors.ts
function findNearest(world, fromId, filter) {
  const fromEntity = getEntity(world, fromId);
  if (!fromEntity) return void 0;
  const fromPos = getComponent(fromEntity, "position");
  if (!fromPos) return void 0;
  let nearestEntity;
  let minDistance = Infinity;
  for (const id of world.order) {
    if (id === fromId) continue;
    const entity = world.entities[id];
    if (!filter(entity)) continue;
    const targetPos = getComponent(entity, "position");
    if (!targetPos) continue;
    const d = distance(fromPos, targetPos);
    if (d < minDistance) {
      minDistance = d;
      nearestEntity = entity;
    }
  }
  return nearestEntity;
}
function isInBounds(world, pos) {
  return isPositionInBounds(world, pos, 0);
}
function isOccupied(world, pos, radius = 0) {
  return !isSegmentClear(world, pos, pos, void 0, radius);
}
function isPathClear(world, fromPos, toPos, actorId, actorRadius = 0) {
  return isSegmentClear(world, fromPos, toPos, actorId, actorRadius);
}
function visibleEntities(world, actorId) {
  const result = [];
  for (const id of world.order) {
    if (id !== actorId) {
      result.push(world.entities[id]);
    }
  }
  return result;
}

// src/systems.ts
var SystemRunner = class {
  systems = [];
  addSystem(system) {
    this.systems.push(system);
  }
  runPhase(world, phase) {
    const events = [];
    for (const system of this.systems) {
      if (system[phase]) {
        const phaseEvents = system[phase](world);
        if (phaseEvents) {
          events.push(...phaseEvents);
        }
      }
    }
    return events;
  }
  runPreAction(world) {
    return this.runPhase(world, "preAction");
  }
  runAction(world) {
    return this.runPhase(world, "action");
  }
  runPostAction(world) {
    return this.runPhase(world, "postAction");
  }
  runTick(world) {
    return this.runPhase(world, "tick");
  }
  runObjective(world) {
    return this.runPhase(world, "objective");
  }
};

// src/objectives.ts
var ObjectiveSystem = class {
  evaluators = /* @__PURE__ */ new Map();
  constructor() {
    this.registerStandardEvaluators();
  }
  registerEvaluator(type, evaluator) {
    this.evaluators.set(type, evaluator);
  }
  evaluate(world, condition) {
    const evaluator = this.evaluators.get(condition.type);
    if (!evaluator) {
      throw new Error(`Unknown objective type: ${condition.type}`);
    }
    return evaluator(world, condition);
  }
  registerStandardEvaluators() {
    this.registerEvaluator("all", (world, cond) => {
      if (!cond.conditions) return true;
      return cond.conditions.every((c) => this.evaluate(world, c));
    });
    this.registerEvaluator("any", (world, cond) => {
      if (!cond.conditions) return true;
      return cond.conditions.some((c) => this.evaluate(world, c));
    });
    this.registerEvaluator("defeat_all", (world) => {
      for (const id of world.order) {
        if (world.entities[id].kind === "enemy") {
          const health = world.entities[id].components["health"];
          if (!health || health.current > 0) {
            return false;
          }
        }
      }
      return true;
    });
    this.registerEvaluator("reach_position", (world, cond) => {
      if (!cond.actorId || !cond.position || cond.radius === void 0) return false;
      const actor = world.entities[cond.actorId];
      if (!actor) return false;
      const pos = getComponent(actor, "position");
      if (!pos) return false;
      return distance(pos, cond.position) <= cond.radius;
    });
    this.registerEvaluator("reach_entity", (world, cond) => {
      if (!cond.actorId || !cond.targetId || cond.radius === void 0) return false;
      const actor = world.entities[cond.actorId];
      const target = world.entities[cond.targetId];
      if (!actor || !target) return false;
      const pos = getComponent(actor, "position");
      const targetPos = getComponent(target, "position");
      if (!pos || !targetPos) return false;
      return distance(pos, targetPos) <= cond.radius;
    });
    this.registerEvaluator("collect_count", (world, cond) => {
      if (!cond.actorId || !cond.kind || cond.count === void 0) return false;
      const actor = world.entities[cond.actorId];
      if (!actor) return false;
      const inventory = getComponent(actor, "inventory");
      if (!inventory) return false;
      return (inventory.counts[cond.kind] || 0) >= cond.count;
    });
    this.registerEvaluator("metric_comparison", (world, cond) => {
      if (!cond.metric || cond.value === void 0 || !cond.operator) return false;
      const actual = world.metrics[cond.metric] || 0;
      switch (cond.operator) {
        case "gt":
          return actual > cond.value;
        case "lt":
          return actual < cond.value;
        case "eq":
          return actual === cond.value;
        case "gte":
          return actual >= cond.value;
        case "lte":
          return actual <= cond.value;
        default:
          return false;
      }
    });
  }
};

// src/systems/movement.ts
var MovementSystem = class {
  name = "movement";
  tick(world) {
    const events = [];
    for (const id of world.order) {
      const entity = world.entities[id];
      const pos = getComponent(entity, "position");
      const motion = getComponent(entity, "motion");
      const movement = getComponent(entity, "movement");
      if (pos && motion && movement) {
        const dist = distance(pos, motion.target);
        if (dist <= movement.speed) {
          pos.x = motion.target.x;
          pos.y = motion.target.y;
          removeComponent(entity, "motion");
          events.push({
            type: "custom",
            subtype: "move_finished",
            frame: world.frame,
            payload: { actorId: id, position: { x: pos.x, y: pos.y } }
          });
        } else {
          const dx = motion.target.x - pos.x;
          const dy = motion.target.y - pos.y;
          const dirX = dx / dist;
          const dirY = dy / dist;
          pos.x += dirX * movement.speed;
          pos.y += dirY * movement.speed;
          events.push({
            type: "custom",
            subtype: "move_progress",
            frame: world.frame,
            payload: { actorId: id, position: { x: pos.x, y: pos.y } }
          });
        }
      }
    }
    return events;
  }
};

// src/actions/handlers.ts
function movePoint(position, direction, distanceToMove) {
  const target = { x: position.x, y: position.y };
  if (direction === "up") target.y += distanceToMove;
  else if (direction === "down") target.y -= distanceToMove;
  else if (direction === "left") target.x -= distanceToMove;
  else if (direction === "right") target.x += distanceToMove;
  return target;
}
var MoveDirectionHandler = class {
  type = "MOVE_DIRECTION";
  validate(ctx, action) {
    const actor = ctx.world.entities[action.actorId];
    if (!actor) return { valid: false, reason: "Actor not found" };
    if (!action.payload) return { valid: false, reason: "Missing move payload" };
    const pos = getComponent(actor, "position");
    if (!pos) return { valid: false, reason: "Actor has no position" };
    const mov = getComponent(actor, "movement");
    if (!mov) return { valid: false, reason: "Actor has no movement component" };
    if (action.payload?.distance !== void 0 && action.payload.distance <= 0) {
      return { valid: false, reason: "Distance must be > 0" };
    }
    return { valid: true };
  }
  start(ctx, action) {
    const actor = ctx.world.entities[action.actorId];
    const pos = getComponent(actor, "position");
    const mov = getComponent(actor, "movement");
    const dir = action.payload.direction;
    let remainingDistance = action.payload.distance ?? mov.stepDistance;
    const actorRadius = actor.components.collision ? actor.components.collision.radius : 0;
    let target = { x: pos.x, y: pos.y };
    let blockedTo;
    let blockedReason;
    while (remainingDistance > 0) {
      const segmentDistance = Math.min(mov.stepDistance, remainingDistance);
      const nextTarget = movePoint(target, dir, segmentDistance);
      if (!isPositionInBounds(ctx.world, nextTarget)) {
        blockedTo = nextTarget;
        blockedReason = "Target out of bounds";
        break;
      }
      if (!isSegmentClear(ctx.world, target, nextTarget, action.actorId, actorRadius)) {
        blockedTo = nextTarget;
        blockedReason = "Path blocked";
        break;
      }
      target = nextTarget;
      remainingDistance -= segmentDistance;
    }
    if (target.x === pos.x && target.y === pos.y && blockedTo) {
      return { localState: { blocked: true, target: blockedTo, blockedTo, reason: blockedReason } };
    }
    setComponent(actor, "motion", {
      from: { x: pos.x, y: pos.y },
      target,
      remainingDistance: distance(pos, target)
    });
    return {
      localState: blockedTo ? { blocked: true, target, blockedTo, reason: blockedReason } : { target }
    };
  }
  step(ctx, state) {
    const actor = ctx.world.entities[state.action.actorId];
    if (state.localState?.blocked && (!actor || !hasComponent(actor, "motion"))) {
      const pos = actor ? getComponent(actor, "position") : void 0;
      return {
        status: "done",
        events: [{
          type: "move_blocked",
          frame: ctx.frame,
          actorId: state.action.actorId,
          from: pos ? { x: pos.x, y: pos.y } : { x: 0, y: 0 },
          to: state.localState.blockedTo ?? state.localState.target
        }]
      };
    }
    if (!actor || !hasComponent(actor, "motion")) {
      return { status: "done", events: [] };
    }
    return { status: "running", events: [], localState: state.localState };
  }
};
var WaitHandler = class {
  type = "WAIT";
  validate(ctx, action) {
    return { valid: action.payload.frames > 0, reason: "Frames must be > 0" };
  }
  start(ctx, action) {
    return { localState: { remaining: action.payload.frames } };
  }
  step(ctx, state) {
    const remaining = state.localState.remaining - 1;
    if (remaining <= 0) {
      return { status: "done", events: [] };
    }
    return { status: "running", events: [], localState: { remaining } };
  }
};
var AttackHandler = class {
  type = "ATTACK";
  validate(ctx, action) {
    const actor = ctx.world.entities[action.actorId];
    if (!actor) return { valid: false, reason: "Actor not found" };
    const combat = getComponent(actor, "combat");
    if (!combat) return { valid: false, reason: "Actor has no combat component" };
    const target = ctx.world.entities[action.payload.targetId];
    if (!target) return { valid: false, reason: "Target not found" };
    const targetHealth = getComponent(target, "health");
    if (!targetHealth || targetHealth.current <= 0) return { valid: false, reason: "Target is already dead or has no health" };
    return { valid: true };
  }
  start(ctx, action) {
    return {};
  }
  step(ctx, state) {
    const actor = ctx.world.entities[state.action.actorId];
    const target = ctx.world.entities[state.action.payload.targetId];
    if (!target) return { status: "failed", failureReason: "Target disappeared", events: [] };
    const pos = getComponent(actor, "position");
    const targetPos = getComponent(target, "position");
    const combat = getComponent(actor, "combat");
    if (pos && targetPos) {
      const dist = distance(pos, targetPos);
      if (dist > combat.range) {
        return { status: "failed", failureReason: "Target out of range", events: [] };
      }
    }
    const targetHealth = getComponent(target, "health");
    targetHealth.current = Math.max(0, targetHealth.current - combat.damage);
    const events = [
      {
        type: "damage",
        frame: ctx.frame,
        actorId: state.action.actorId,
        targetId: target.id,
        damage: combat.damage,
        currentBefore: targetHealth.current + combat.damage,
        currentAfter: targetHealth.current
      }
      // Use as any to bypass strict type if missing fields
    ];
    if (targetHealth.current <= 0) {
      events.push({
        type: "death",
        frame: ctx.frame,
        actorId: state.action.actorId,
        targetId: target.id
      });
    }
    return { status: "done", events };
  }
};
var PickUpHandler = class {
  type = "PICK_UP";
  validate(ctx, action) {
    const actor = ctx.world.entities[action.actorId];
    if (!actor) return { valid: false, reason: "Actor not found" };
    const target = ctx.world.entities[action.payload.targetId];
    if (!target) return { valid: false, reason: "Target not found" };
    const collectible = getComponent(target, "collectible");
    if (!collectible || collectible.collectedBy) return { valid: false, reason: "Item not collectible or already collected" };
    return { valid: true };
  }
  start() {
    return {};
  }
  step(ctx, state) {
    const actor = ctx.world.entities[state.action.actorId];
    const target = ctx.world.entities[state.action.payload.targetId];
    if (!target) return { status: "failed", failureReason: "Item disappeared", events: [] };
    const pos = getComponent(actor, "position");
    const targetPos = getComponent(target, "position");
    if (pos && targetPos) {
      if (distance(pos, targetPos) > 1) {
        return { status: "failed", failureReason: "Item out of pickup range", events: [] };
      }
    }
    const collectible = getComponent(target, "collectible");
    collectible.collectedBy = actor.id;
    let inventory = getComponent(actor, "inventory");
    if (!inventory) {
      inventory = { counts: {} };
      setComponent(actor, "inventory", inventory);
    }
    inventory.counts[collectible.kind] = (inventory.counts[collectible.kind] || 0) + 1;
    return {
      status: "done",
      events: [{
        type: "pickup",
        frame: ctx.frame,
        actorId: actor.id,
        targetId: target.id
      }]
    };
  }
};

// src/world-runner.ts
function buildReplay(result, metadata = {}) {
  return {
    engine: metadata.engine || "todaycode-game-engine",
    engineVersion: metadata.engineVersion || "0.2.6",
    levelSlug: metadata.levelSlug || "unknown",
    levelVersion: metadata.levelVersion || 1,
    seed: metadata.seed || 0,
    frameCount: result.frames,
    worldFrames: result.worldFrames,
    outcome: {
      over: true,
      passed: result.success
    },
    schemaVersion: metadata.schemaVersion,
    config: metadata.config,
    meta: metadata.meta
  };
}
var WorldRunner = class {
  constructor(world, systemRunner, actionRunner, objectiveSystem, planRunner, options = {}) {
    this.world = world;
    this.systemRunner = systemRunner;
    this.actionRunner = actionRunner;
    this.objectiveSystem = objectiveSystem;
    this.planRunner = planRunner;
    this.options = options;
    if (this.options.initialPlanState) {
      this.planState = this.options.initialPlanState;
    } else {
      if (this.planRunner instanceof YieldPlanRunner) {
        this.planState = this.planRunner.createState();
      } else if (this.planRunner instanceof PlanRunner) {
        this.planState = this.planRunner.createState([]);
      }
    }
  }
  world;
  systemRunner;
  actionRunner;
  objectiveSystem;
  planRunner;
  options;
  events = [];
  worldFrames = [];
  planState;
  run() {
    const maxFrames = this.options.maxFrames ?? 1e4;
    if (this.options.winCondition && this.objectiveSystem.evaluate(this.world, this.options.winCondition)) {
      this.worldFrames.push(captureWorldFrame(this.world, this.world.frame, []));
      return {
        success: true,
        frames: this.world.frame,
        events: this.events,
        worldFrames: this.worldFrames
      };
    }
    if (this.options.lossCondition && this.objectiveSystem.evaluate(this.world, this.options.lossCondition)) {
      this.worldFrames.push(captureWorldFrame(this.world, this.world.frame, []));
      return {
        success: false,
        frames: this.world.frame,
        events: this.events,
        worldFrames: this.worldFrames
      };
    }
    while (this.world.frame < maxFrames) {
      const frameEvents = [];
      const ctx = {
        world: this.world,
        frame: this.world.frame
      };
      const systemEvents = this.systemRunner.runTick(this.world);
      frameEvents.push(...systemEvents);
      this.events.push(...systemEvents);
      if (this.planRunner instanceof YieldPlanRunner) {
        if (!this.planState.failed && !this.planState.done) {
          const ticked = this.planRunner.tick(ctx, this.planState);
          this.planState = ticked.state;
          frameEvents.push(...ticked.events);
          this.events.push(...ticked.events);
        }
      } else if (this.planRunner instanceof PlanRunner) {
        if (!this.planState.failed) {
          const ticked = this.planRunner.tick(ctx, this.planState);
          this.planState = ticked.state;
          frameEvents.push(...ticked.events);
          this.events.push(...ticked.events);
        }
      }
      this.worldFrames.push(captureWorldFrame(this.world, this.world.frame, frameEvents));
      if (this.options.winCondition && this.objectiveSystem.evaluate(this.world, this.options.winCondition)) {
        this.world.frame++;
        this.worldFrames.push(captureWorldFrame(this.world, this.world.frame, []));
        return {
          success: true,
          frames: this.world.frame,
          events: this.events,
          worldFrames: this.worldFrames
        };
      }
      if (this.options.lossCondition && this.objectiveSystem.evaluate(this.world, this.options.lossCondition)) {
        this.world.frame++;
        this.worldFrames.push(captureWorldFrame(this.world, this.world.frame, []));
        return {
          success: false,
          frames: this.world.frame,
          events: this.events,
          worldFrames: this.worldFrames
        };
      }
      if (this.planState && this.planState.failed) {
        this.world.frame++;
        this.worldFrames.push(captureWorldFrame(this.world, this.world.frame, []));
        return {
          success: false,
          // plan failed and objectives didn't succeed
          frames: this.world.frame,
          events: this.events,
          worldFrames: this.worldFrames
        };
      }
      if (this.planState && this.planState.done) {
        this.world.frame++;
        this.worldFrames.push(captureWorldFrame(this.world, this.world.frame, []));
        return {
          success: false,
          // plan done but objectives didn't succeed
          frames: this.world.frame,
          events: this.events,
          worldFrames: this.worldFrames
        };
      }
      this.world.frame++;
    }
    this.worldFrames.push(captureWorldFrame(this.world, this.world.frame, []));
    return {
      success: false,
      frames: this.world.frame,
      events: this.events,
      worldFrames: this.worldFrames
    };
  }
};

// src/live-world-session.ts
var LiveWorldSession = class {
  constructor(world, systems, actions, objectives, options = {}) {
    this.world = world;
    this.systems = systems;
    this.actions = actions;
    this.objectives = objectives;
    this.options = options;
    this.worldFrames.push(captureWorldFrame(this.world, this.world.frame, []));
    if (this.options.winCondition && this.objectives.evaluate(this.world, this.options.winCondition)) {
      this.over = true;
      this.success = true;
    } else if (this.options.lossCondition && this.objectives.evaluate(this.world, this.options.lossCondition)) {
      this.over = true;
      this.success = false;
    }
  }
  world;
  systems;
  actions;
  objectives;
  options;
  events = [];
  worldFrames = [];
  over = false;
  success = false;
  runAction(action) {
    if (this.over) {
      return { status: "interrupted", events: [] };
    }
    const startCtx = { world: this.world, frame: this.world.frame };
    const started = this.actions.start(startCtx, action);
    let actionState = started.state;
    if (!actionState || actionState.status === "failed") {
      return {
        status: "failed",
        events: started.events,
        failureReason: actionState?.failureReason
      };
    }
    if (actionState.status === "done") {
      this.worldFrames.push(captureWorldFrame(this.world, this.world.frame, started.events));
      this.events.push(...started.events);
      return { status: "done", events: started.events };
    }
    const actionEvents = [];
    let pendingFrameEvents = [...started.events];
    const maxFrames = this.options.maxFrames ?? 2e3;
    while (actionState && actionState.status === "running" && !this.over) {
      const frameEvents = [...pendingFrameEvents];
      pendingFrameEvents = [];
      const tickCtx = { world: this.world, frame: this.world.frame };
      const systemEvents = this.systems.runTick(this.world);
      frameEvents.push(...systemEvents);
      const tickResult = this.actions.tick(tickCtx, actionState);
      actionState = tickResult.state;
      frameEvents.push(...tickResult.events);
      this.worldFrames.push(captureWorldFrame(this.world, this.world.frame, frameEvents));
      this.events.push(...frameEvents);
      actionEvents.push(...frameEvents);
      if (this.options.winCondition && this.objectives.evaluate(this.world, this.options.winCondition)) {
        this.over = true;
        this.success = true;
      } else if (this.options.lossCondition && this.objectives.evaluate(this.world, this.options.lossCondition)) {
        this.over = true;
        this.success = false;
      }
      this.world.frame++;
      if (!this.over && this.world.frame >= maxFrames) {
        this.over = true;
        this.success = false;
      }
    }
    if (!actionState || actionState.status === "running") {
      return { status: "interrupted", events: actionEvents };
    }
    return {
      status: actionState.status,
      events: actionEvents,
      failureReason: actionState.failureReason
    };
  }
  isOver() {
    return this.over;
  }
  result() {
    return {
      success: this.success,
      frames: this.world.frame,
      events: this.events,
      worldFrames: this.worldFrames
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ACTION_ATTACK,
  ACTION_CAST,
  ACTION_MOVE,
  ACTION_PICK_UP,
  ACTION_SAY,
  ACTION_WAIT,
  ActionRunner,
  AttackHandler,
  DEFAULT_MAX_FRAMES,
  FrameDriver,
  LiveWorldSession,
  MoveDirectionHandler,
  MovementSystem,
  MultiFrameActionRunner,
  ObjectiveSystem,
  PickUpHandler,
  PlanRunner,
  RNG,
  SystemRunner,
  UNIT,
  WaitHandler,
  WorldRunner,
  YieldPlanRunner,
  add,
  addEntity,
  buildReplay,
  captureWorldFrame,
  createWorld,
  distance,
  findNearest,
  getBlockingEntities,
  getComponent,
  getEntity,
  hasComponent,
  isInBounds,
  isOccupied,
  isPathClear,
  isPositionInBounds,
  isSegmentClear,
  isqrt,
  len,
  len2,
  moveToward,
  removeComponent,
  removeEntity,
  scale,
  setComponent,
  sub,
  tile,
  toOutcomeJSON,
  toReplayJSON,
  updateEntity,
  visibleEntities,
  withComponent,
  withDecisionInterval,
  withMaxFrames,
  withoutComponent
});
//# sourceMappingURL=index.cjs.map