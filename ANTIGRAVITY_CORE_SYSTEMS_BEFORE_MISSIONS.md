# Antigravity Task: Finish Core Gameplay Systems Before Migrating Missions

## Background

`todaycode-game-engine` has already been updated with a CodeCombat-style programmable world kernel:

- `WorldState`, `Entity`, components
- `ActionRunner`
- `MultiFrameActionRunner`
- `PlanRunner`
- `YieldPlanRunner`
- `SystemRunner`
- selectors
- objectives

However, the current core is still mostly framework-level. It has the system runner, but it does not yet have the concrete systems and standard action handlers needed for a real CodeCombat-like mission loop.

Do not migrate `todaycode-missions` deeply yet. If Missions implements movement/combat/pickup by itself now, the new core will only be a wrapper and each game will duplicate engine behavior.

The next task is to finish the minimum real core systems first.

---

## Important Direction: No Grid Runtime

Do not build the new Missions runtime around grid, tile, row/col, slot, or cell occupancy.

Use continuous world coordinates:

```ts
position: { x: number; y: number }
collision: { radius: number }
movement: { speed: number; stepDistance: number }
```

Movement commands such as `moveRight()` should move by relative world distance:

```txt
moveRight -> target.x = current.x + stepDistance
moveLeft  -> target.x = current.x - stepDistance
moveUp    -> target.y = current.y + stepDistance
moveDown  -> target.y = current.y - stepDistance
```

Then the movement should happen over multiple frames according to speed, bounds, and collision rules.

---

## Target Architecture

The intended loop is:

```txt
student code / command stream
-> YieldPlanRunner yields one action
-> standard action handler validates and creates action state or motion intent
-> concrete systems tick world state frame by frame
-> objectives evaluate after world update
-> WorldFrame records tracked state for replay/rendering
-> when action finishes, YieldPlanRunner resumes script
```

Example:

```js
hero.moveRight()
hero.moveRight()
hero.attack(enemy)
```

must behave like:

```txt
yield MOVE_DIRECTION(right)
wait until movement action completes across frames
yield MOVE_DIRECTION(right)
wait until movement action completes across frames
yield ATTACK(enemy)
wait until attack completes
```

Do not run all commands in one frame.

---

## Phase 1: Add Missing Standard Components

Add or extend component types in `todaycode-game-engine`.

Required components:

```ts
export interface PositionComponent {
  x: number;
  y: number;
}

export interface MovementComponent {
  speed: number;
  stepDistance: number;
}

export interface MotionComponent {
  from: { x: number; y: number };
  target: { x: number; y: number };
  remainingDistance: number;
}

export interface CollisionComponent {
  radius: number;
}

export interface BlockingComponent {
  blocksMovement: boolean;
}

export interface HealthComponent {
  current: number;
  max: number;
}

export interface CombatComponent {
  damage: number;
  range: number;
  cooldownFrames?: number;
}

export interface CollectibleComponent {
  kind: string;
  collectedBy?: string;
}

export interface InventoryComponent {
  counts: Record<string, number>;
}
```

Keep these generic. Do not put Missions-specific story terms into core.

---

## Phase 2: Add World Bounds Support

Add world bounds as explicit config, either in `WorldState` metadata/config or as a standard world-level component.

Use continuous bounds:

```ts
export interface WorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}
```

Needed behavior:

- reject movement target outside bounds, or clamp only if explicitly configured
- `isInBounds(position, radius?)`
- segment/path checks should respect bounds

Tests:

- position inside bounds passes
- position outside bounds fails
- radius near edge is handled correctly
- movement outside bounds fails deterministically

---

## Phase 3: Add Concrete Movement System

Add a concrete `MovementSystem`.

Responsibilities:

- find entities with `Position` + active `Motion`
- move from current position toward motion target by `speed` per frame
- stop exactly at target when remaining distance is less than speed
- remove/clear `Motion` when done
- emit deterministic movement events

Recommended event shapes:

```ts
{
  type: 'move_started',
  frame,
  actorId,
  from,
  target
}

{
  type: 'move_progress',
  frame,
  actorId,
  position
}

{
  type: 'move_finished',
  frame,
  actorId,
  position
}
```

Do not use grid occupancy.

Tests:

- movement takes multiple frames when target is farther than speed
- entity reaches exact target
- no floating drift after completion
- event sequence is deterministic
- two runs with same state/action produce identical state/events

---

## Phase 4: Add Bounds and Collision Checks

Add reusable helpers/systems for movement validation.

Required helpers:

```ts
isPositionInBounds(world, position, radius?)
isSegmentClear(world, from, to, actorId?)
getBlockingEntities(world)
distance(a, b)
```

Collision should be radius-based:

```txt
actor path segment vs blocking entity circle
```

For the first version, it is acceptable to implement conservative collision:

- reject if target overlaps a blocking entity
- reject if the straight segment crosses a blocking entity radius

Tests:

- target overlapping blocker fails
- path crossing blocker fails
- path not touching blocker passes
- actor does not collide with itself
- tie/order remains deterministic

---

## Phase 5: Add Standard Multi-frame Action Handlers

Add standard action handlers to core, not to Missions.

### MOVE_DIRECTION

Input:

```ts
{
  type: 'MOVE_DIRECTION',
  actorId: 'hero',
  payload: { direction: 'right' }
}
```

Behavior:

- read actor `Position`
- read actor or world default `Movement.stepDistance`
- compute target from direction
- validate bounds
- validate collision/path clear
- create active motion/multi-frame action state
- complete only after movement reaches target

### MOVE_TO

Input:

```ts
{
  type: 'MOVE_TO',
  actorId: 'hero',
  payload: { target: { x: 12, y: 5 } }
}
```

Behavior:

- same movement pipeline, but explicit target

### WAIT

Consumes N frames.

```ts
{
  type: 'WAIT',
  actorId: 'hero',
  payload: { frames: 10 }
}
```

### ATTACK

Input:

```ts
{
  type: 'ATTACK',
  actorId: 'hero',
  payload: { targetId: 'enemy-1' }
}
```

Behavior:

- validate target exists
- validate target is alive
- validate range using continuous distance
- support optional wind-up frames
- apply damage only on completion frame
- emit attack/damage/death events

### PICK_UP

Input:

```ts
{
  type: 'PICK_UP',
  actorId: 'hero',
  payload: { targetId: 'gem-1' }
}
```

Behavior:

- validate item exists
- validate item is collectible
- validate actor is within pickup radius
- mark item collected or remove it from active selectors
- increment actor inventory count
- emit pickup event

Tests:

- `MOVE_DIRECTION` is multi-frame
- failed move stops action
- `WAIT` consumes correct number of frames
- `ATTACK` only damages in range
- dead entity cannot be attacked
- `PICK_UP` increments inventory
- collected item is ignored by selectors

---

## Phase 6: Add Missing Objective Evaluators

Core needs these objective evaluators for Missions:

### reach_position

```ts
{
  type: 'reach_position',
  actorId: 'hero',
  position: { x: 16, y: 5 },
  radius: 0.75
}
```

### reach_entity

```ts
{
  type: 'reach_entity',
  actorId: 'hero',
  targetId: 'gate',
  radius: 0.75
}
```

### collect_count

```ts
{
  type: 'collect_count',
  actorId: 'hero',
  kind: 'gem',
  count: 3
}
```

### defeat_all

Existing `defeat_all` can stay, but ensure it works against standard `Health` and `Team` components.

Tests:

- `reach_position` passes within radius
- `reach_position` fails outside radius
- `reach_entity` follows target entity position
- `collect_count` reads inventory/collected state
- `defeat_all` ignores already-dead enemies

---

## Phase 7: Add WorldFrame / Tracked State

Missions needs replay/rendering data. Add minimal WorldFrame support to core.

Recommended type:

```ts
export interface WorldFrame {
  frame: number;
  tracked: Record<string, {
    position?: { x: number; y: number };
    health?: { current: number; max: number };
    alive?: boolean;
    collected?: boolean;
  }>;
  events: GameEvent[];
}
```

Add helper:

```ts
captureWorldFrame(world, frame, events, trackedComponents?)
```

Tests:

- captures only tracked components
- entity order is deterministic
- frame output is JSON serializable
- same world gives same frame JSON

---

## Phase 8: Core Vertical Slice Test

Before touching `todaycode-missions`, add a core-level integration test:

Scenario:

```txt
world bounds: minX=0, maxX=20, minY=0, maxY=10
hero position: x=4, y=5
hero movement: stepDistance=4, speed=1
gate position: x=16, y=5
objective: reach_entity(hero, gate, radius=0.75)
plan:
  hero.moveRight()
  hero.moveRight()
  hero.moveRight()
```

Expected:

- first `moveRight` takes multiple frames
- second command does not start before first movement completes
- third command does not start before second movement completes
- hero ends at or near `x=16, y=5`
- objective completes only after final movement
- captured WorldFrames show position progression
- repeated run with same input is deep-equal deterministic

This is the minimum acceptance slice.

---

## Phase 9: Only Then Update todaycode-missions

After Phase 8 passes in core, update `todaycode-missions`.

Missions should only:

- map lesson/course data into `WorldState`
- define mission level schema using continuous coordinates
- convert old lessons into new world level definitions
- expose hero API such as `moveRight`, `attack`, `findNearestEnemy`
- convert student code/command stream into yielded standard actions
- use core `YieldPlanRunner`
- use core standard action handlers/systems/objectives
- render replay using WorldFrames/events

Missions should not own generic:

- movement physics
- bounds checks
- collision checks
- attack resolution
- pickup resolution
- objective evaluation

Those belong in core.

---

## Missions Data Migration Direction

Old course data can still be reused.

Reuse as-is:

- course metadata
- lesson title
- lesson description
- instructions
- hints
- starter code
- solution/reference code
- thumbnail/asset keys where still valid

Migrate:

- old map/spawn data
- old win condition
- old command permissions
- old enemy/item/goal placement

Do not migrate to grid. Convert to continuous coordinates.

Example new level:

```ts
{
  bounds: { minX: 0, maxX: 20, minY: 0, maxY: 10 },
  defaults: {
    movement: { stepDistance: 4, speed: 1 }
  },
  entities: [
    {
      id: 'hero',
      type: 'hero',
      components: {
        position: { x: 4, y: 5 },
        movement: { stepDistance: 4, speed: 1 },
        collision: { radius: 0.5 },
        team: { id: 'player' },
        inventory: { counts: {} }
      }
    },
    {
      id: 'gate',
      type: 'goal',
      components: {
        position: { x: 16, y: 5 },
        collision: { radius: 0.75 }
      }
    }
  ],
  objectives: [
    { type: 'reach_entity', actorId: 'hero', targetId: 'gate', radius: 0.75 }
  ],
  api: {
    commands: ['moveRight']
  }
}
```

---

## Commands

From `todaycode-game-engine`:

```bash
pnpm test
pnpm run lint
pnpm run build
```

After core vertical slice passes, from `todaycode-missions`:

```bash
pnpm test
pnpm run lint
pnpm run build
```

---

## Final Acceptance Criteria

Core is ready for Missions when:

- no grid/slot/tile runtime is introduced
- standard movement uses continuous coordinates
- `MOVE_DIRECTION` is multi-frame
- `YieldPlanRunner` resumes only after action completion
- bounds and collision are enforced
- `reach_position`, `reach_entity`, `collect_count`, `defeat_all` work
- `WorldFrame` captures tracked state for replay/rendering
- the simple `moveRight` mission slice passes inside core
- test/lint/build pass

Only after that should `todaycode-missions` be migrated.

