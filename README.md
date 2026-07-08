# todaycode-game-engine

Shared, deterministic game engine consumed by both **todaycode-be** (`arena-service`)
and **CodeClash-fe**. One implementation of Farm Wars' rules, not two —
previously the backend (Node, real matches) and the frontend (browser,
practice matches) each had their own separate simulation, and they had
already drifted (the frontend's copy scored tree-planting immediately; the
real backend only scores on deposit — a real gameplay bug, not just a
theoretical risk). This repo is that single source of truth.

## Table of contents

- [Why this exists](#why-this-exists)
- [What's inside](#whats-inside)
  - [`packages/gamecore`](#packagesgamecore--game-agnostic-base)
  - [`packages/farmwars`](#packagesfarmwars--the-ruleset)
- [Determinism guarantee](#determinism-guarantee)
- [Install](#install)
- [Usage](#usage)
  - [A. Running a full match forward](#a-running-a-full-match-forward-server-style)
  - [B. Replaying an already-computed match](#b-replaying-an-already-computed-match-client-style)
  - [C. Using `FrameDriver` for synchronous/scripted agents](#c-using-framedriver-for-synchronousscripted-agents)
- [API reference](#api-reference)
- [Versioning](#versioning)
- [Development](#development)

## Why this exists

A single game — Farm Wars — used to have its rules written out twice:

- **`apps/arena-service/src/engine/farmwars`** in `todaycode-be`: the real
  simulation. Runs when a player submits code for an official/ranked match.
  Ticks 3× per turn, computes combat, HP, debuffs, gift RNG — the actual
  source of the recorded outcome.
- **`step()`** in `CodeClash-fe`: a separate, hand-written re-implementation
  used both to preview practice runs and to reconstruct backend matches for
  replay (by re-simulating from the bots' raw per-turn text output instead of
  from the backend's own computed events).

Two independent implementations of the same rules, maintained by hand,
forever, in two different repos. They already disagreed on real gameplay
(see above) and on resolution (backend simulates 3 discrete ticks per turn;
the frontend jumped straight to the turn's final position in one step).

This repo promotes the backend's engine — the one that already had no
framework dependencies, already had test coverage, and already implemented
the newer v2 combat/debuff system the frontend never got — to a place both
sides can import directly. There is now exactly one engine. Fixing a rule
means editing one file, bumping one version tag, and both consumers upgrading
deliberately.

## What's inside

Two packages, built together into one distributable (see [Install](#install)
for why it's one package, not two).

### `packages/gamecore` — game-agnostic base

Not Farm Wars-specific at all. A generic contract any turn-based game engine
implements, so a future second game doesn't reinvent this. Ported from a Go
reference implementation (`pkg/gamecore`).

| File | What it gives you |
|---|---|
| `gamecore.interface.ts` | The `Engine` contract every game implements: `name`, `version`, `init`, `applyOrders`, `tick`, `isOver`, `result`. Also `Commander` (an agent's decision-maker), `Outcome`, `Grader`, `Solvable`. |
| `frame-driver.ts` | `FrameDriver` — a generic turn loop: visit each commander in numeric agent-id order, collect orders, apply them, tick the engine, collect events, repeat until `isOver()`. Produces a `Replay`. Synchronous by design — see [Usage C](#c-using-framedriver-for-synchronousscripted-agents) for when this fits and when it doesn't. |
| `replay.ts` | `Replay` / `FrameEvents` / `toReplayJSON` / `toOutcomeJSON` — the wire envelope, with `omitempty`-style serialization matching the Go original exactly (empty `scores`/`metrics` are omitted; a zero-value entry inside a non-empty map is kept). |
| `rng.ts` | `RNG` — seeded splitmix64. Returns `bigint` (raw outputs routinely exceed `Number.MAX_SAFE_INTEGER`); replicates Go's `uint64` wraparound bit-for-bit, including negative-seed reinterpretation. |
| `vec2.ts` | Integer-only vector math. `UNIT`-based milli-units instead of floats; `Math.trunc` (not `Math.floor`) everywhere division was ported from Go, to match Go's toward-zero truncation for negative operands. |
| `level.ts` | `LevelDef` — a generic level/scenario definition (`slug`, `version`, `gameSlug`, opaque `definition`/`grading` payloads). |

### `packages/farmwars` — the ruleset

The first (currently only) game implementing the `Engine` contract above.

| File | What it gives you |
|---|---|
| `state.ts` | Types: `FarmWarsState`, `TeamState`, `Actor`, `Tree`, `GiftBox`, `Position`, `ActorStats`. This is the full snapshot of a match at one tick. |
| `events.ts` | `FarmWarsEvent` — 19 variants describing everything that can happen in one tick (see table below). |
| `constants.ts` | Grid size, tick/frame counts, per-actor-type base stats, direction deltas. |
| `initial-state.ts` | `createInitialState(seed)` — builds turn-0 state (bases, starting actors) deterministically from a seed. |
| `orders.ts` | `parseActions(rawLines, actorCount)` — parses a bot's raw stdout lines (movement directions + optional gift-choice + optional turn-0 base-setup line) into structured `Actions`. |
| `gift-rng.ts` | Deterministic gift-box spawn positions per turn. |
| `scoring.ts`, `combat.ts` | Scoring rules; v2 combat resolution (simultaneous damage between adjacent enemy actors, death, fruit-drop-on-death). |
| `tick.ts` | `applyTick(state, frame, actions1, actions2)` — the actual per-frame simulation step. This is *the* rules implementation; everything else supports it. |
| `wire.ts` | `serializeForSide(state, perspective)` — builds the JSON a bot process reads over stdin, from one side's point of view (hides the enemy harvester's inventory). |
| `farmwars.engine.ts` | `FarmWarsEngine` — wraps the above into the generic `gamecore` `Engine` contract. |
| `replay.ts` | `applyEvent` / `applyFrame` — an **event-log reducer**. Given a state and one frame's already-computed `events`, derives the next state directly (e.g. a `move` event just writes the actor's new position) without re-deriving any rule. This is what makes replay-without-re-simulation possible — see [Usage B](#b-replaying-an-already-computed-match-client-style). |

<details>
<summary><strong>All 19 <code>FarmWarsEvent</code> types</strong></summary>

| Event | Fires when |
|---|---|
| `move` | An actor's position changes this tick |
| `tree_plant` | A planter plants a tree |
| `harvest` | A harvester picks fruit off a tree it's standing on |
| `tree_destroy` | A worm destroys an enemy tree |
| `harvester_reset` | A harvester is forced back to base, losing carried inventory |
| `worm_reset` | A worm is forced back to base (e.g. by a gift effect) |
| `collision_worm_harv` | An enemy worm steals fruit from a harvester |
| `planter_vs_worm` | *(declared for completeness — not constructed anywhere in the current engine; superseded by the `combat`/`unit_death` system below)* |
| `fruit_grow` | A tree's fruit count increases with age |
| `score` | A team's score changes (`harvest_deposit`, `worm_steal`, or `gift_reward`) |
| `gift_expire` | An unclaimed gift box times out |
| `gift_spawn` | New gift boxes appear |
| `gift_pickup` | An actor picks up a gift box |
| `combat` | Two actors of opposing teams occupy the same tile and deal simultaneous damage |
| `unit_death` | An actor's HP reaches 0 |
| `unit_respawn` | A dead actor's respawn timer reaches 0 and it returns to base at full HP |
| `fruit_drop` | A harvester carrying fruit dies, dropping its inventory |
| `debuff_applied` / `debuff_expired` | The venomous-bite slow effect (worm attack) is applied to / expires on an actor |

</details>

## Determinism guarantee

Every file in both packages must stay pure:

- No DB, network, or filesystem access.
- No wall-clock reads (`Date.now()`, `performance.now()`, timers).
- No process/container spawning — untrusted bot code never runs in here, only
  inside a consumer's own sandbox/runner layer (`libs/sandbox`/`libs/runner`
  in `todaycode-be`, the Pyodide worker in `CodeClash-fe`).
- The only randomness source is the seeded `RNG` in `gamecore/rng.ts` — never
  `Math.random()`.

Given the same `(engineVersion, levelVersion, seed, inputs)`, the engine
**must** produce identical `events[]` and `outcome` — on a server, in a
browser tab, doesn't matter. That's the whole point: it's safe to run the
literal same code in both places.

## Install

Both consumers install this repo as a **git dependency** — no npm registry
involved:

```json
{
  "dependencies": {
    "todaycode-game-engine": "github:amas-nghia/todaycode-game-engine#v0.1.0"
  }
}
```

It's published as **one package with two subpath exports**, not two separate
installable packages. (A pnpm/npm git-dependency pointed at a monorepo
*subdirectory* works inconsistently across package managers; one package with
an `exports` map is unambiguous everywhere.)

```ts
import { FarmWarsEngine, applyFrame } from 'todaycode-game-engine/farmwars'
import { FrameDriver } from 'todaycode-game-engine/gamecore'
```

Both ESM (`import`) and CommonJS (`require`) resolve correctly — `todaycode-be`
(NestJS) and `CodeClash-fe` (Next.js) don't need to agree on a module system.

## Usage

### A. Running a full match forward (server style)

This is what `arena-service`'s `Simulator` does today, and what a client-side
practice mode would do too — spawn two bot processes, feed them state each
turn, apply their orders, tick 3×, repeat.

```ts
import { FarmWarsEngine } from 'todaycode-game-engine/farmwars'

const engine = new FarmWarsEngine()
const level = { slug: 'farmwars-v2', version: 2, gameSlug: 'farm-wars', definition: {} }

let state = engine.init(level, /* seed */ 42)

for (let turn = 1; turn <= 100 && !engine.isOver(state); turn++) {
  // 1. Serialize this state for each bot (hides enemy harvester inventory)
  const wireA = serializeForSide(state, 1)
  const wireB = serializeForSide(state, 2)

  // 2. Ask each bot for this turn's orders (however you run bot code —
  //    a subprocess, a container, a Pyodide worker — is entirely up to you;
  //    the engine doesn't know or care)
  const rawLinesA = await runBot(botProcessA, wireA)
  const rawLinesB = await runBot(botProcessB, wireB)
  const ordersA = parseActions(rawLinesA, 3).directions
  const ordersB = parseActions(rawLinesB, 3).directions

  // 3. Apply orders, then tick 3 frames (1 turn = 3 ticks)
  state = engine.applyOrders(state, 1, ordersA)
  state = engine.applyOrders(state, 2, ordersB)
  for (let f = 0; f < 3; f++) {
    const frameIdx = (turn - 1) * 3 + f
    const { state: nextState, events } = engine.tick(state, frameIdx)
    state = nextState
    // collect `events` into your own frames[] array if you're building a replay
  }
}

const outcome = engine.result(state) // { winner, scores: { 1: n, 2: n } }
```

### B. Replaying an already-computed match (client style)

For watching a match that was already simulated (an official submission, a
leaderboard replay) — **do not re-run bots or re-derive any rule**. The
backend already computed `events` for every frame; just apply them.

```ts
import { applyFrame } from 'todaycode-game-engine/farmwars'
import type { FarmWarsState } from 'todaycode-game-engine/farmwars'

// `keyframe` = the full state at frame 0, sent once by the backend
// `frames`   = [{ frame, events }, ...] for every frame after that
let state: FarmWarsState = resultData.keyframe

const rendered: { frame: number; state: FarmWarsState }[] = [{ frame: 0, state }]

for (const f of resultData.frames) {
  state = applyFrame(state, f.events)
  rendered.push({ frame: f.frame, state })
}

// `rendered` now supports instant seek to any frame — no re-simulation,
// no bot re-execution, and it's provably the same state the backend itself
// held after that frame, not an approximation of it.
```

`applyFrame`/`applyEvent` never mutate their input — each call returns a new
state object, so keeping every frame's state around (for scrubbing) is safe.

### C. Using `FrameDriver` for synchronous/scripted agents

`FrameDriver.run()` is the generic loop from `gamecore`, useful for tests,
scripted scenarios, or any case where a `Commander.decide()` can return orders
**synchronously** — it does not fit real bot matches directly, because real
bots need async I/O (spawning a process, awaiting stdout, per-turn timeouts).
`arena-service`'s real `Simulator` hand-rolls the async version of this same
loop for exactly that reason (see [Usage A](#a-running-a-full-match-forward-server-style)).

```ts
import { FrameDriver, withMaxFrames, type Commander } from 'todaycode-game-engine/gamecore'
import { FarmWarsEngine } from 'todaycode-game-engine/farmwars'

class ScriptedCommander implements Commander {
  constructor(private orders: string[]) {}
  decide() { return this.orders }
}

const driver = new FrameDriver(withMaxFrames(300))
const replay = driver.run(
  new FarmWarsEngine(),
  { slug: 'farmwars-v2', version: 2, gameSlug: 'farm-wars', definition: {} },
  /* seed */ 42,
  new Map([
    [1, new ScriptedCommander(['right', 'stay', 'stay'])],
    [2, new ScriptedCommander(['left', 'stay', 'stay'])],
  ]),
)
// replay: { engine, engineVersion, levelSlug, seed, frameCount, frames, outcome }
```

## API reference

Full exported surface (see each package's `index.ts` for the authoritative
list — this is the shape, not necessarily every field):

**`todaycode-game-engine/gamecore`**
`Engine`, `Commander`, `Grader`, `Solvable`, `Outcome`, `State`, `Event`, `Order`,
`FrameDriver`, `withMaxFrames`, `withDecisionInterval`, `Replay`, `FrameEvents`,
`toReplayJSON`, `toOutcomeJSON`, `RNG`, `Vec2` + vector helpers, `LevelDef`.

**`todaycode-game-engine/farmwars`**
`FarmWarsEngine`, `FarmWarsState`, `FarmWarsEvent`, `TeamState`, `Actor`,
`ActorStats`, `Tree`, `GiftBox`, `Position`, `TeamID`, `GiftChoice`,
`createInitialState`, `team1Bases`, `team2Bases`, `parseActions`, `Actions`,
`applyTick`, `serializeForSide`, `applyEvent`, `applyFrame`,
`giftPositionsForTurn`, plus the constants in `constants.ts`.

## Versioning

Semver git tags (`v0.1.0`, `v0.2.0`, …). A gameplay rule change is a version
bump; each consumer upgrades on its own schedule by bumping the tag in its
own `package.json` — never silently, never automatically.

## Development

```bash
pnpm install
pnpm test     # jest — every spec in packages/*/__tests__ (51 today)
pnpm build    # tsup — emits dist/{gamecore,farmwars}.{js,cjs,d.ts,d.cts}
pnpm lint     # tsc --noEmit
```

`dist/` is committed to this repo (not gitignored). This is deliberate: since
consumers install via a plain git dependency rather than a real npm registry,
there's no separate "publish" step that builds on their behalf — what's
checked in at a given tag *is* what they get. **Run `pnpm build` and commit
the result as part of any change to `packages/*/src`**, or a consumer bumping
to a new tag will receive stale compiled output.
