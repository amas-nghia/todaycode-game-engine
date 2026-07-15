# todaycode-game-engine

A TypeScript library that simulates a game **frame by frame, as pure logic**.
No rendering, no I/O, fully deterministic — the same input always produces the
same result, whether it runs in a browser, on a server, or in CI.

**You give it:**

- a **world** — a list of entities (hero, enemies, coins, walls)
- a **plan** — the sequence of actions a player wants to perform (`move`, `attack`, `pick up`)
- the **rules** — what each action does, and what happens automatically every frame
- a **goal** — the win/loss condition

**It gives you back:**

- whether the plan **succeeded or failed**
- a **frame-by-frame recording** of everything that happened, so a client can
  play it back as an animation without running the engine itself

```
         INPUT                          SIMULATION                      OUTPUT
┌────────────────────────┐   ┌───────────────────────────┐   ┌─────────────────────────┐
│ WorldState (entities)  │   │  WorldRunner.run()        │   │ WorldRunnerResult       │
│ Plan (list of Actions) │   │  each frame:              │   │  ├ success: boolean     │
│ Systems (auto rules)   │ → │   1. run systems          │ → │  ├ frames: number       │
│ Action handlers        │   │   2. advance the plan     │   │  ├ events[]             │
│ Objectives (win/loss)  │   │   3. snapshot the world   │   │  └ worldFrames[]        │
│ seed                   │   │   4. check objectives     │   │        │ buildReplay()  │
└────────────────────────┘   │   5. frame++              │   │        ▼                │
                             └───────────────────────────┘   │  Replay (JSON)          │
                                                             └─────────────────────────┘
```

## Architecture: ECS + Actions/Plans + Objectives

The engine is built on the **Entity–Component–System (ECS)** pattern, with two
extra layers on top: **Actions/Plans** ("what a character does") and
**Objectives** ("what counts as winning"). Six concepts, one file each:

| Concept | What it is | File |
|---|---|---|
| **Entity + Component** | Everything in the game is an entity: `{ id, kind, components }`. Components are plain data — `position {x,y}`, `health {current,max}`, `movement {speed}`. Entities have **no methods**; all behavior lives in Systems and Actions. | [entity.ts](src/entity.ts), [components.ts](src/components.ts) |
| **WorldState** | The container holding all entities, the current `frame`, the `seed`, optional map `bounds`, and an `order` array that fixes iteration order (this is what makes the simulation deterministic). | [world.ts](src/world.ts) |
| **Action** | One command from a character: `{ type: 'MOVE_DIRECTION', actorId: 'hero', payload: {...} }`. Each `type` has a **handler** that defines how the command plays out — possibly across **many frames** (walking 5 units takes 5 frames). | [actions.ts](src/actions.ts), [multi-frame-action.ts](src/multi-frame-action.ts) |
| **Plan** | A sequence of actions that runs **one at a time**: action 1 must finish before action 2 starts — exactly like a student writing `move(); attack();`. Written as a generator (`function*`) that yields actions. | [plan-runner.ts](src/plan-runner.ts) |
| **System** | A rule that runs **automatically every frame**, with no command needed: `MovementSystem` slides entities toward their destination, a trap deals damage, gravity pulls things down. | [systems.ts](src/systems.ts), [systems/movement.ts](src/systems/movement.ts) |
| **Objective** | Win/loss conditions declared as plain JSON objects: `{ type: 'reach_position', ... }`, composable with `all` / `any`. | [objectives.ts](src/objectives.ts) |

**[`WorldRunner`](src/world-runner.ts)** ties everything together. Every frame, in this exact order:

1. Run every System — e.g. `MovementSystem` moves each entity `speed` units toward its target.
2. Advance the Plan one step — the current action gets a `step()` call; if it finished, the next action starts.
3. Snapshot the world (position/health/collected of every entity) plus this frame's events → `worldFrames[]`.
4. Check `winCondition` / `lossCondition` — if met, stop and return `success`.
5. If the plan ran out of actions (or failed) without winning → stop with `success: false`. If `maxFrames` is reached → timeout, `success: false`.

The single most important design decision — **Actions and Systems are
decoupled**: a `MOVE_DIRECTION` action does *not* move the entity itself. Its
handler only attaches a `motion` component (the destination). `MovementSystem`
is what actually moves the entity a little each frame. When the entity arrives,
the system removes `motion`, the handler sees that and reports `done`, and the
plan moves on to the next action. This is how one command like "walk 12 units"
plays out smoothly over 12 frames while the plan code stays simple and sequential.

## Install

The package is published to GitHub Packages. Add an `.npmrc` with a token that
has the `read:packages` scope:

```
@amas.nghia:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

```bash
pnpm add @amas.nghia/todaycode-game-engine
```

## Getting started — a complete example

The task: a hero stands at (10,10) and must reach (15,15). The player submits
the plan "move right, then move up". Copy this block and it runs as-is:

```ts
import {
  createWorld, addEntity,                          // step 1
  SystemRunner, MovementSystem,                    // step 2
  MultiFrameActionRunner, MoveDirectionHandler,    // step 3
  YieldPlanRunner, type PlanIterator,              // step 4
  ObjectiveSystem, WorldRunner,                    // step 5
  buildReplay, toReplayJSON,                       // step 6
} from '@amas.nghia/todaycode-game-engine'

// ── Step 1: create a world and drop entities into it ─────────────────
const world = createWorld(/* seed */ 123)
world.bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 }

addEntity(world, {
  id: 'hero',
  kind: 'hero',
  components: {
    position: { x: 10, y: 10 },
    movement: { speed: 1, stepDistance: 5 },  // moves 1 unit/frame; each move command covers 5 units by default
    collision: { radius: 0.5 },
  },
})

// ── Step 2: register systems (rules that run automatically) ──────────
const systems = new SystemRunner()
systems.addSystem(new MovementSystem())

// ── Step 3: register action handlers (which commands exist) ──────────
const actions = new MultiFrameActionRunner()
actions.registerHandler(new MoveDirectionHandler())

// ── Step 4: the plan — the player's/bot's script ─────────────────────
function* heroPlan(): PlanIterator {
  yield { type: 'MOVE_DIRECTION', actorId: 'hero', payload: { direction: 'right' } }
  yield { type: 'MOVE_DIRECTION', actorId: 'hero', payload: { direction: 'up' } }
}
const plan = new YieldPlanRunner(actions, heroPlan())

// ── Step 5: win condition + run ──────────────────────────────────────
const runner = new WorldRunner(world, systems, actions, new ObjectiveSystem(), plan, {
  maxFrames: 100,
  winCondition: { type: 'reach_position', actorId: 'hero', position: { x: 15, y: 15 }, radius: 0.1 },
})
const result = runner.run()   // ← the whole simulation happens here, synchronously

// ── Step 6: read the result ──────────────────────────────────────────
result.success       // true — the hero reached (15,15)
result.frames        // number of frames simulated
result.worldFrames   // per-frame snapshots — what a client uses to draw the animation

const replayJSON = toReplayJSON(buildReplay(result, {
  levelSlug: 'demo-01', levelVersion: 1, seed: 123,
}))  // JSON you can store in a DB / send to a client for playback
```

### What the output looks like

`result.worldFrames` is an array with one element per frame:

```jsonc
{
  "frame": 3,
  "tracked": {                       // snapshot of every entity that has position/health/collectible
    "hero": { "position": { "x": 13, "y": 10 } }
  },
  "events": [                        // what happened during this frame
    { "type": "custom", "subtype": "move_progress", "frame": 3,
      "payload": { "actorId": "hero", "position": { "x": 13, "y": 10 } } }
  ]
}
```

A client just reads `worldFrames` in order to replay the whole match — **it
never needs to run the engine**. `buildReplay()` wraps the result with metadata
(seed, level, version) into the standard `Replay` envelope ([replay.ts](src/replay.ts))
for storage.

## Writing your own game rules — the 3 extension points

The engine contains no game-specific rules. Your game = the kernel + three
things you write yourself, plugged in via `registerHandler` / `addSystem` /
`registerEvaluator`:

### 1) A new action handler — give characters a new command

Implement `MultiFrameActionHandler`: `validate` (is the command legal?),
`start` (runs once when the action begins), `step` (runs every frame and
returns `running` / `done` / `failed`).

```ts
import {
  type MultiFrameActionHandler, type MultiFrameActionState, type MultiFrameActionStepResult,
  type Action, type ActionContext, type ValidationResult,
  getComponent, type HealthComponent,
} from '@amas.nghia/todaycode-game-engine'

// A HEAL command: restores 5 HP per frame, for `frames` frames
export class HealHandler
  implements MultiFrameActionHandler<{ frames: number }, { remaining: number }> {
  type = 'HEAL'

  validate(ctx: ActionContext, a: Action<{ frames: number }>): ValidationResult {
    const actor = ctx.world.entities[a.actorId]
    if (!actor) return { valid: false, reason: 'Actor not found' }
    if (!getComponent<HealthComponent>(actor, 'health')) return { valid: false, reason: 'No health' }
    return { valid: true }
  }

  start(_ctx: ActionContext, a: Action<{ frames: number }>) {
    return { localState: { remaining: a.payload!.frames } }
  }

  step(ctx: ActionContext, s: MultiFrameActionState<{ frames: number }, { remaining: number }>)
    : MultiFrameActionStepResult<{ remaining: number }> {
    const actor = ctx.world.entities[s.action.actorId]
    const hp = getComponent<HealthComponent>(actor, 'health')!
    hp.current = Math.min(hp.max, hp.current + 5)
    const remaining = s.localState!.remaining - 1
    if (remaining <= 0 || hp.current >= hp.max) return { status: 'done', events: [] }
    return { status: 'running', events: [], localState: { remaining } }
  }
}

// actions.registerHandler(new HealHandler())
// in a plan:  yield { type: 'HEAL', actorId: 'hero', payload: { frames: 3 } }
```

### 2) A new system — add an automatic rule

Implement `System` with a `tick(world)` method (runs every frame, before
actions). Always iterate entities through `world.order` to stay deterministic:

```ts
import { type System, type WorldState, type GameEvent, getComponent } from '@amas.nghia/todaycode-game-engine'

// A spike trap: anything standing on (5,5) loses 1 HP per frame
export class SpikeTrapSystem implements System {
  name = 'spike-trap'
  tick(world: WorldState): GameEvent[] {
    const events: GameEvent[] = []
    for (const id of world.order) {
      const e = world.entities[id]
      const pos = getComponent<{ x: number; y: number }>(e, 'position')
      const hp = getComponent<{ current: number; max: number }>(e, 'health')
      if (pos && hp && pos.x === 5 && pos.y === 5 && hp.current > 0) {
        hp.current -= 1
        events.push({ type: 'custom', subtype: 'spike', frame: world.frame, payload: { id } })
      }
    }
    return events
  }
}
```

### 3) A new objective — add a win/loss condition type

```ts
const objectives = new ObjectiveSystem()
objectives.registerEvaluator('hero_alive', (world) => {
  const hp = world.entities['hero']?.components['health'] as { current: number } | undefined
  return !!hp && hp.current > 0
})
// use it like any built-in: winCondition: { type: 'hero_alive' }
```

## What's in the box

**Components** ([components.ts](src/components.ts)) — plain TS interfaces; an entity declares only what it needs:
`position` · `movement` · `motion` · `collision` · `blocking` · `health` ·
`combat` · `collectible` · `inventory` · `team` · `cooldown` · `programmable` · `objectiveTarget`

**Action handlers** ([actions/handlers.ts](src/actions/handlers.ts)):

| `type` | payload | Required components | Behavior |
|---|---|---|---|
| `MOVE_DIRECTION` | `{ direction: 'up'\|'down'\|'left'\|'right', distance? }` | `position`, `movement` | Walks in a direction; stopped by map bounds / blockers → `move_blocked` event, keeping whatever progress was made |
| `ATTACK` | `{ targetId }` | actor: `combat`; target: `health` | Deals damage if the target is within `range`; emits `damage` and `death` events |
| `PICK_UP` | `{ targetId }` | target: `collectible` | Picks up an item within radius 1.0 → adds it to `inventory` |
| `WAIT` | `{ frames }` | — | Stands still for n frames |

**Objectives** ([objectives.ts](src/objectives.ts)):
`all` / `any` (nest via `conditions[]`) · `defeat_all` · `reach_position` ·
`reach_entity` · `collect_count` · `metric_comparison`

**Events** ([events.ts](src/events.ts)) — what clients use to drive animations:
`move` · `move_blocked` · `attack` · `damage` · `death` · `pickup` · `score` ·
`objective_completed` · `log` · `custom {subtype, payload}`

**Other utilities**: `findNearest` / `isPathClear` / `isOccupied` ([selectors.ts](src/selectors.ts)) —
world queries for use inside handlers/systems; `distance` / `isSegmentClear` ([physics.ts](src/physics.ts));
seeded `RNG` ([rng.ts](src/rng.ts)); fixed-point `vec2` ([vec2.ts](src/vec2.ts)) for games that need integer math.

## Low-level API: the `Engine` contract

Besides the World Kernel above, the package ships a minimal contract for games
that want to **manage their entire state themselves** instead of using ECS:
the [`Engine`](src/gamecore.interface.ts) interface — five methods,
`init / applyOrders / tick / isOver / result` — where state, orders, and events
are all opaque (`unknown`). The infrastructure can run any such engine without
knowing its rules. [`FrameDriver`](src/frame-driver.ts) is the reference loop
for this layer: `new FrameDriver(engine, commanders).run(level, seed)` → `Replay`.

Use this layer when your game isn't a "character on a map" (card games, number
games, turn-based duels). Both layers produce the same `Replay` envelope — the
`Engine` layer fills `frames[]` (events only), while the World Kernel fills
`worldFrames[]` (events + snapshots). If you ever want to wrap the World Kernel
behind an `Engine`, the bridge interfaces `WorldEngine` / `ActionEngine` in
[gamecore.interface.ts](src/gamecore.interface.ts) exist for exactly that.

## Determinism rules — mandatory for all code plugged into the engine

The engine's promise: **the same `(seed, level, plan)` produces the same
`worldFrames[]` and outcome on every machine**. Replays must stay playable
forever, and a client–server mismatch means either a bug or cheating. So inside
every handler/system/objective:

- ❌ No I/O (network/fs/DB), no reading the clock (`Date.now`), no spawning processes.
- ❌ No `Math.random()` — if you need randomness, use the seeded `RNG` derived from `world.seed`.
- ❌ Never iterate `Object.keys(world.entities)` or a `Map` in arbitrary order —
  **always iterate `world.order`** (every built-in system/selector already does).
- ✅ Plain JS `number` coordinates are fine, as long as updates are pure and run
  in a fixed order. Verify by running the simulation twice and deep-comparing
  results (see [determinism.spec.ts](src/__tests__/determinism.spec.ts)).
- Player/bot code never runs *inside* the engine — it runs in the app's sandbox
  and only submits a plan (or orders).

## Developing this repo

```bash
pnpm install
pnpm test      # jest — src/__tests__/ ; integration.spec.ts is the live version of the examples above
pnpm build     # tsup → dist/ (ESM + CJS + .d.ts)
pnpm lint      # tsc -b --noEmit
```

**`dist/` is committed.** Release flow: edit `src` → `pnpm build` → commit
`dist/` too → tag `v0.x.y` → CI ([publish.yml](.github/workflows/publish.yml))
publishes to GitHub Packages. Skipping the build means consumers get stale
compiled code on the next tag bump (this has caused a real bug before).
Also keep the default `engineVersion` in `buildReplay`
([world-runner.ts](src/world-runner.ts)) in sync with `package.json`.
