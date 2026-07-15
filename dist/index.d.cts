type EntityId = string;
type ComponentType = string;
type ComponentMap = Record<ComponentType, unknown>;
interface Entity {
    id: EntityId;
    kind: string;
    components: ComponentMap;
}
/**
 * Gets a component from an entity if it exists.
 */
declare function getComponent<T>(entity: Entity, component: ComponentType): T | undefined;
/**
 * Checks if an entity has a specific component.
 */
declare function hasComponent(entity: Entity, component: ComponentType): boolean;
/**
 * Mutates the entity by adding or updating a component.
 */
declare function setComponent<T>(entity: Entity, component: ComponentType, data: T): void;
/**
 * Mutates the entity by removing a component.
 */
declare function removeComponent(entity: Entity, component: ComponentType): void;
/**
 * Returns a new entity with the added component (immutable).
 */
declare function withComponent<T>(entity: Entity, component: ComponentType, data: T): Entity;
/**
 * Returns a new entity without the specified component (immutable).
 */
declare function withoutComponent(entity: Entity, component: ComponentType): Entity;

interface WorldBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}
interface WorldState {
    frame: number;
    seed: number;
    rngState?: unknown;
    entities: Record<EntityId, Entity>;
    order: EntityId[];
    metrics: Record<string, number>;
    tags?: Record<string, EntityId[]>;
    bounds?: WorldBounds;
    level?: unknown;
}
/**
 * Creates a new, empty world state.
 */
declare function createWorld(seed: number, frame?: number): WorldState;
/**
 * Adds an entity to the world state. Deterministically adds to the end of the order array.
 * Throws if the entity ID already exists.
 */
declare function addEntity(world: WorldState, entity: Entity): void;
/**
 * Removes an entity from the world state by ID.
 * Keeps the order deterministic by using filter (or splice if found).
 */
declare function removeEntity(world: WorldState, entityId: EntityId): void;
/**
 * Retrieves an entity by ID from the world state.
 */
declare function getEntity(world: WorldState, entityId: EntityId): Entity | undefined;
/**
 * Updates an entity in the world state.
 * Throws if the entity ID does not exist.
 */
declare function updateEntity(world: WorldState, entity: Entity): void;

interface BaseEvent {
    type: string;
    frame: number;
}
interface MoveEvent extends BaseEvent {
    type: 'move';
    actorId: EntityId;
    from: {
        x: number;
        y: number;
    };
    to: {
        x: number;
        y: number;
    };
}
interface MoveBlockedEvent extends BaseEvent {
    type: 'move_blocked';
    actorId: EntityId;
    from: {
        x: number;
        y: number;
    };
    to: {
        x: number;
        y: number;
    };
}
interface AttackEvent extends BaseEvent {
    type: 'attack';
    actorId: EntityId;
    targetId: EntityId;
}
interface DamageEvent extends BaseEvent {
    type: 'damage';
    actorId: EntityId;
    targetId: EntityId;
    damage: number;
    currentBefore: number;
    currentAfter: number;
}
interface DeathEvent extends BaseEvent {
    type: 'death';
    actorId: EntityId;
    targetId: EntityId;
}
interface PickupEvent extends BaseEvent {
    type: 'pickup';
    actorId: EntityId;
    targetId: EntityId;
}
interface ScoreEvent extends BaseEvent {
    type: 'score';
    teamId?: string | number;
    score: number;
    reason?: string;
}
interface ObjectiveCompletedEvent extends BaseEvent {
    type: 'objective_completed';
    objectiveId: string;
}
interface LogEvent extends BaseEvent {
    type: 'log';
    message: string;
}
interface CustomEvent extends BaseEvent {
    type: 'custom';
    subtype: string;
    payload: unknown;
}
type GameEvent = MoveEvent | MoveBlockedEvent | AttackEvent | DamageEvent | DeathEvent | PickupEvent | ScoreEvent | ObjectiveCompletedEvent | LogEvent | CustomEvent;

interface Action<Payload = unknown> {
    type: string;
    actorId: EntityId;
    payload?: Payload;
    source?: 'runner' | 'system' | 'auto';
}
interface ValidationResult {
    valid: boolean;
    reason?: string;
}
interface ActionResult {
    events: GameEvent[];
}
interface ActionContext {
    world: WorldState;
    frame: number;
}
interface ActionHandler<Payload = unknown> {
    type: string;
    validate(ctx: ActionContext, action: Action<Payload>): ValidationResult;
    apply(ctx: ActionContext, action: Action<Payload>): ActionResult;
}
declare const ACTION_MOVE = "MOVE";
declare const ACTION_ATTACK = "ATTACK";
declare const ACTION_PICK_UP = "PICK_UP";
declare const ACTION_CAST = "CAST";
declare const ACTION_SAY = "SAY";
declare const ACTION_WAIT = "WAIT";

/**
 * Level definition contract — port of pkg/gamecore/level.go.
 *
 * No golden fixture exercises LevelDef directly, so `unknown` for the opaque
 * `definition`/`grading` payloads is sufficient — no need to preserve
 * raw-byte fidelity like Go's `json.RawMessage`.
 */
interface LevelDef {
    slug: string;
    version: number;
    gameSlug: string;
    definition: unknown;
    grading?: unknown;
}
/** Throws instead of returning a Go-style error. */
interface LevelValidator {
    validateLevel(definition: unknown): void;
}

/**
 * pkg/gamecore contract, ported to TypeScript.
 *
 * Determinism contract (mirrors the Go package doc):
 *  - Given the same (engineVersion, levelVersion, seed, inputs), an Engine MUST
 *    produce identical events[] and outcome under the supported JavaScript
 *    runtime used by the frontend/server simulation layers.
 *  - No wall-clock, no DB access, no I/O, no process/container spawning inside
 *    gamecore or any Engine implementation. Untrusted user code never runs here
 *    — it only runs inside a domain's runner/sandbox.
 *  - Continuous-space systems may use JavaScript numbers for positions,
 *    distances, and speeds. Keep updates pure and ordered, and use the seeded
 *    RNG stream (rng.ts) for randomness. Rulebooks that need fixed-point math
 *    can opt into vec2.ts explicitly.
 */

/** Opaque simulation state — engines cast internally, the driver never inspects it. */
type State = unknown;
/** Opaque per-tick event — consumers replay these; the driver never inspects them. */
type Event = unknown;
/** Opaque per-agent order/command — engines interpret these; the driver never inspects them. */
type Order = unknown;
/**
 * Outcome of a match/level attempt.
 *
 * `scores` and `metrics` are `Record<string, number>` even though the Go side's
 * `Scores` is `map[int]int64` — encoding/json marshals integer map keys as
 * quoted decimal strings, so the JSON shape (and thus what TS consumers
 * actually see over the wire) is string-keyed for both maps.
 */
interface Outcome {
    over: boolean;
    passed?: boolean;
    stars?: number;
    winner?: number;
    scores?: Record<string, number>;
    metrics?: Record<string, number>;
}

/**
 * Game rules. Pure & deterministic — see the module doc comment above.
 *
 * Go's `(value, error)` return convention becomes idiomatic TS: methods return
 * the value directly and throw on failure.
 */
interface Engine {
    name(): string;
    version(): string;
    init(level: LevelDef, seed: number): State;
    applyOrders(state: State, agentId: number, orders: Order[]): State;
    tick(state: State, frame: number): {
        state: State;
        events: Event[];
    };
    isOver(state: State): boolean;
    result(state: State): Outcome;
}
/** Decision layer: produces orders for one agent at one frame. */
interface Commander {
    decide(state: State, agentId: number, frame: number): Order[];
}
/** Optional capability: grade a final state against the level definition. */
interface Grader {
    grade(final: State, level: LevelDef): Outcome;
}
/** Optional capability: compute (or estimate) the optimal solution for a level. */
interface Solvable {
    solve(level: LevelDef): {
        optimalSteps: number;
        ok: boolean;
    };
}
/**
 * Optional capability: Engine that runs on the new programmable world kernel.
 */
interface WorldEngine extends Engine {
    getWorldState(state: State): WorldState;
}
/**
 * Optional capability: Engine that accepts standard Actions instead of opaque Orders.
 */
interface ActionEngine extends Engine {
    applyActions(state: State, agentId: number, actions: Action[]): State;
}

/**
 * Fixed-point 2D vector math in milli-units. This is available for rulebooks
 * that need integer math; the newer continuous-space world kernel may use
 * JavaScript numbers for position and physics state.
 *
 * Every function here returns a NEW Vec2 and never mutates its inputs, per
 * this repo's immutability convention.
 */
/** One "tile" unit, expressed in milli-units. */
declare const UNIT = 1000;
interface Vec2 {
    readonly x: number;
    readonly y: number;
}
declare function tile(x: number, y: number): Vec2;
declare function add(v: Vec2, o: Vec2): Vec2;
declare function sub(v: Vec2, o: Vec2): Vec2;
declare function scale(v: Vec2, n: number): Vec2;
declare function len2(v: Vec2): number;
declare function len(v: Vec2): number;
/**
 * Moves `v` toward `target` by at most `maxStep` milli-units, snapping onto
 * the target if it is within `maxStep`. Returns `v` unchanged if `maxStep <= 0`.
 *
 * CRITICAL: the Go source computes `delta.X*maxStep/dist` using Go's `/`,
 * which truncates toward zero (NOT floor) — e.g. Go's `-7/2 == -3`, whereas
 * `Math.floor(-7/2) === -4`. `delta.x`/`delta.y` can be negative (target to
 * the left/above `v`), so this MUST use `Math.trunc`, never `Math.floor`.
 */
declare function moveToward(v: Vec2, target: Vec2, maxStep: number): Vec2;
/**
 * Integer square root (floor), matching the Go implementation's Newton's
 * method loop bit-for-bit. Every division here uses `Math.trunc` uniformly
 * (even though `n`/`x` are always positive after the guard below, so
 * `trunc === floor` in practice) so the pattern stays consistent and
 * defensively correct if this function is ever reused elsewhere.
 */
declare function isqrt(n: number): number;

/**
 * Deterministic splitmix64 RNG — port of pkg/gamecore/rng.go.
 *
 * CRITICAL: raw splitmix64 outputs are full 64-bit values that routinely
 * exceed Number.MAX_SAFE_INTEGER (2^53-1 ~= 9.007e15) — e.g. seed=1's first
 * output is 10451216379200822465. `next()` therefore returns `bigint`, not
 * `number`. Every intermediate `+`/`^`/`*` is masked to 64 bits with
 * `BigInt.asUintN(64, ...)` to replicate Go's silent uint64 wraparound.
 */
declare class RNG {
    private state;
    /**
     * Go seeds with `uint64(seed)` where `seed` is `int64` — for a negative
     * seed this is a two's-complement reinterpretation. `BigInt.asUintN(64, ...)`
     * replicates that wrap for negative bigints exactly.
     */
    constructor(seed: number | bigint);
    next(): bigint;
    /**
     * Returns a value in [0, n) using rejection sampling (no modulo bias).
     * Bounded by `n`, so the return value is a plain `number` (safe: `n` is a
     * small int by contract). Throws (not "panics") when `n <= 0`.
     */
    intN(n: number): number;
}

/**
 * Replay envelope — port of pkg/gamecore/replay.go.
 */

interface FrameEvents {
    frame: number;
    events: Event[];
}
interface WorldFrame {
    frame: number;
    tracked: Record<string, {
        position?: {
            x: number;
            y: number;
        };
        health?: {
            current: number;
            max: number;
        };
        alive?: boolean;
        collected?: boolean;
    }>;
    events: Event[];
}
declare function captureWorldFrame(world: WorldState, frame: number, events: Event[]): WorldFrame;
interface Replay {
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
declare function toOutcomeJSON(outcome: Outcome): Record<string, unknown>;
declare function toReplayJSON(replay: Replay): Record<string, unknown>;

/**
 * FrameDriver — port of pkg/gamecore/frame_driver.go.
 *
 * Drives one match to completion: at each decision point, visits every
 * commander (in ascending numeric agent-id order) to collect orders, applies
 * them to the engine, then ticks the engine once. Pure orchestration — no DB,
 * no I/O, no cancellation context (dropped; see port notes below).
 */

declare const DEFAULT_MAX_FRAMES = 3600;
interface FrameDriverConfig {
    maxFrames: number;
    decisionInterval: number;
}
type FrameDriverOption = (config: FrameDriverConfig) => void;
declare function withMaxFrames(n: number): FrameDriverOption;
declare function withDecisionInterval(n: number): FrameDriverOption;
declare class FrameDriver {
    private readonly maxFrames;
    private readonly decisionInterval;
    constructor(...opts: FrameDriverOption[]);
    /**
     * Runs one match to completion (or until maxFrames is reached).
     *
     * Note: the Go signature also takes a `context.Context` for cancellation.
     * There is no idiomatic TS equivalent worth forcing into a synchronous,
     * pure driver, so it is omitted entirely rather than half-ported.
     */
    run(engine: Engine, level: LevelDef, seed: number, commanders: Map<number, Commander>): Replay;
    private isDecisionPoint;
}

interface PositionComponent {
    x: number;
    y: number;
}
interface MovementComponent {
    speed: number;
    stepDistance: number;
}
interface MotionComponent {
    from: {
        x: number;
        y: number;
    };
    target: {
        x: number;
        y: number;
    };
    remainingDistance: number;
}
interface CollisionComponent {
    radius: number;
}
interface BlockingComponent {
    blocksMovement: boolean;
}
interface HealthComponent {
    current: number;
    max: number;
}
interface CombatComponent {
    damage: number;
    range: number;
    cooldownFrames?: number;
}
interface CollectibleComponent {
    kind: string;
    collectedBy?: string;
}
interface InventoryComponent {
    counts: Record<string, number>;
}
interface TeamComponent {
    id: string | number;
}
interface CooldownComponent {
    actions: Record<string, number>;
}
interface ProgrammableComponent {
    agentId: number | string;
    visibleTeam?: string | number;
    apiProfile?: string;
}
interface ObjectiveTargetComponent {
    targetId?: EntityId;
    targetPosition?: {
        x: number;
        y: number;
    };
}

declare class ActionRunner {
    private handlers;
    registerHandler(handler: ActionHandler): void;
    run(ctx: ActionContext, actions: Action[]): GameEvent[];
}

type MultiFrameActionStatus = 'running' | 'done' | 'failed';
interface MultiFrameActionState<Payload = unknown, LocalState = unknown> {
    action: Action<Payload>;
    startedFrame: number;
    updatedFrame: number;
    status: MultiFrameActionStatus;
    localState?: LocalState;
    failureReason?: string;
}
interface MultiFrameActionStepResult<LocalState = unknown> {
    status: MultiFrameActionStatus;
    events: GameEvent[];
    localState?: LocalState;
    failureReason?: string;
}
interface MultiFrameActionHandler<Payload = unknown, LocalState = unknown> {
    type: string;
    validate(ctx: ActionContext, action: Action<Payload>): ValidationResult;
    start?(ctx: ActionContext, action: Action<Payload>): {
        events?: GameEvent[];
        localState?: LocalState;
    };
    step(ctx: ActionContext, state: MultiFrameActionState<Payload, LocalState>): MultiFrameActionStepResult<LocalState>;
}
interface MultiFrameActionTickResult {
    state: MultiFrameActionState | null;
    events: GameEvent[];
}
declare class MultiFrameActionRunner {
    private handlers;
    registerHandler(handler: MultiFrameActionHandler): void;
    start(ctx: ActionContext, action: Action): MultiFrameActionTickResult;
    tick(ctx: ActionContext, state: MultiFrameActionState | null): MultiFrameActionTickResult;
}

interface PlanStep {
    action: Action;
}
interface PlanRunnerState {
    queue: PlanStep[];
    current: MultiFrameActionState | null;
    completed: number;
    failed: boolean;
    failureReason?: string;
}
interface PlanRunnerTickResult {
    state: PlanRunnerState;
    events: GameEvent[];
    done: boolean;
}
interface PlanRunnerOptions {
    stopOnFailure?: boolean;
}
type PlanYield = Action | null | undefined;
type PlanIterator = Iterator<PlanYield, void, MultiFrameActionTickResult | undefined>;
/**
 * Runs beginner-style sequential plans: one action starts, receives ticks until
 * done, then the next action starts. This mirrors the CodeCombat "plan" idea
 * without embedding a language runtime in gamecore.
 */
declare class PlanRunner {
    private readonly actions;
    private readonly options;
    constructor(actions: MultiFrameActionRunner, options?: PlanRunnerOptions);
    createState(actions: Action[]): PlanRunnerState;
    tick(ctx: ActionContext, state: PlanRunnerState): PlanRunnerTickResult;
}
interface YieldPlanRunnerState {
    current: MultiFrameActionState | null;
    completed: number;
    failed: boolean;
    done: boolean;
    failureReason?: string;
    lastResult?: MultiFrameActionTickResult;
}
interface YieldPlanRunnerTickResult {
    state: YieldPlanRunnerState;
    events: GameEvent[];
    done: boolean;
}
/**
 * Runs a generator/iterator plan. The iterator yields an Action, the action runs
 * across frames, then the iterator is resumed with the completed action result.
 */
declare class YieldPlanRunner {
    private readonly actions;
    private readonly plan;
    private readonly options;
    constructor(actions: MultiFrameActionRunner, plan: PlanIterator, options?: PlanRunnerOptions);
    createState(): YieldPlanRunnerState;
    tick(ctx: ActionContext, state: YieldPlanRunnerState): YieldPlanRunnerTickResult;
}

/**
 * Finds the nearest entity matching a filter predicate.
 * Deterministic tie-breaking: by shortest distance, then by entity order.
 */
declare function findNearest(world: WorldState, fromId: EntityId, filter: (entity: Entity) => boolean): Entity | undefined;
declare function isInBounds(world: WorldState, pos: {
    x: number;
    y: number;
}): boolean;
/**
 * Checks if a given position is occupied by any entity that blocks movement.
 */
declare function isOccupied(world: WorldState, pos: {
    x: number;
    y: number;
}, radius?: number): boolean;
declare function isPathClear(world: WorldState, fromPos: {
    x: number;
    y: number;
}, toPos: {
    x: number;
    y: number;
}, actorId?: EntityId, actorRadius?: number): boolean;
/**
 * Returns all entities visible from a given entity's perspective.
 */
declare function visibleEntities(world: WorldState, actorId: EntityId): Entity[];

interface System {
    name: string;
    preAction?(world: WorldState): GameEvent[];
    action?(world: WorldState): GameEvent[];
    postAction?(world: WorldState): GameEvent[];
    tick?(world: WorldState): GameEvent[];
    objective?(world: WorldState): GameEvent[];
}
declare class SystemRunner {
    private systems;
    addSystem(system: System): void;
    runPhase(world: WorldState, phase: keyof Omit<System, 'name'>): GameEvent[];
    runPreAction(world: WorldState): GameEvent[];
    runAction(world: WorldState): GameEvent[];
    runPostAction(world: WorldState): GameEvent[];
    runTick(world: WorldState): GameEvent[];
    runObjective(world: WorldState): GameEvent[];
}

interface ObjectiveCondition {
    type: string;
    actorId?: string;
    targetId?: string;
    targetPos?: {
        x: number;
        y: number;
    };
    position?: {
        x: number;
        y: number;
    };
    radius?: number;
    count?: number;
    kind?: string;
    metric?: string;
    operator?: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
    value?: number;
    conditions?: ObjectiveCondition[];
}
type ObjectiveEvaluator = (world: WorldState, condition: ObjectiveCondition) => boolean;
declare class ObjectiveSystem {
    private evaluators;
    constructor();
    registerEvaluator(type: string, evaluator: ObjectiveEvaluator): void;
    evaluate(world: WorldState, condition: ObjectiveCondition): boolean;
    private registerStandardEvaluators;
}

declare function distance(a: {
    x: number;
    y: number;
}, b: {
    x: number;
    y: number;
}): number;
declare function isPositionInBounds(world: WorldState, pos: {
    x: number;
    y: number;
}, radius?: number): boolean;
declare function getBlockingEntities(world: WorldState): Array<{
    id: EntityId;
    x: number;
    y: number;
    radius: number;
}>;
declare function isSegmentClear(world: WorldState, from: {
    x: number;
    y: number;
}, to: {
    x: number;
    y: number;
}, actorId?: EntityId, actorRadius?: number): boolean;

declare class MovementSystem implements System {
    name: string;
    tick(world: WorldState): GameEvent[];
}

declare class MoveDirectionHandler implements MultiFrameActionHandler<{
    direction: 'up' | 'down' | 'left' | 'right';
}> {
    type: string;
    validate(ctx: ActionContext, action: Action<{
        direction: 'up' | 'down' | 'left' | 'right';
    }>): ValidationResult;
    start(ctx: ActionContext, action: Action<{
        direction: 'up' | 'down' | 'left' | 'right';
    }>): {
        localState: {
            blocked: boolean;
            target: {
                x: number;
                y: number;
            };
            reason: string;
        };
    } | {
        localState: {
            target: {
                x: number;
                y: number;
            };
            blocked?: undefined;
            reason?: undefined;
        };
    };
    step(ctx: ActionContext, state: any): MultiFrameActionStepResult;
}
declare class WaitHandler implements MultiFrameActionHandler<{
    frames: number;
}, {
    remaining: number;
}> {
    type: string;
    validate(ctx: ActionContext, action: Action<{
        frames: number;
    }>): ValidationResult;
    start(ctx: ActionContext, action: Action<{
        frames: number;
    }>): {
        localState: {
            remaining: number;
        };
    };
    step(ctx: ActionContext, state: any): MultiFrameActionStepResult<{
        remaining: number;
    }>;
}
declare class AttackHandler implements MultiFrameActionHandler<{
    targetId: string;
}> {
    type: string;
    validate(ctx: ActionContext, action: Action<{
        targetId: string;
    }>): ValidationResult;
    start(ctx: ActionContext, action: Action<{
        targetId: string;
    }>): {};
    step(ctx: ActionContext, state: any): MultiFrameActionStepResult;
}
declare class PickUpHandler implements MultiFrameActionHandler<{
    targetId: string;
}> {
    type: string;
    validate(ctx: ActionContext, action: Action<{
        targetId: string;
    }>): ValidationResult;
    start(): {};
    step(ctx: ActionContext, state: any): MultiFrameActionStepResult;
}

interface WorldRunnerOptions {
    maxFrames?: number;
    winCondition?: ObjectiveCondition;
    lossCondition?: ObjectiveCondition;
    initialPlanState?: YieldPlanRunnerState | PlanRunnerState;
}
interface WorldRunnerResult {
    success: boolean;
    frames: number;
    events: GameEvent[];
    worldFrames: WorldFrame[];
}
interface ReplayMetadata {
    engine?: string;
    engineVersion?: string;
    levelSlug?: string;
    levelVersion?: number;
    seed?: number;
    schemaVersion?: number;
    config?: Record<string, unknown>;
    meta?: Record<string, unknown>;
}
declare function buildReplay(result: WorldRunnerResult, metadata?: ReplayMetadata): Replay;
declare class WorldRunner {
    world: WorldState;
    systemRunner: SystemRunner;
    actionRunner: MultiFrameActionRunner;
    objectiveSystem: ObjectiveSystem;
    private planRunner;
    private options;
    private events;
    private worldFrames;
    private planState;
    constructor(world: WorldState, systemRunner: SystemRunner, actionRunner: MultiFrameActionRunner, objectiveSystem: ObjectiveSystem, planRunner: YieldPlanRunner | PlanRunner, options?: WorldRunnerOptions);
    run(): WorldRunnerResult;
}

export { ACTION_ATTACK, ACTION_CAST, ACTION_MOVE, ACTION_PICK_UP, ACTION_SAY, ACTION_WAIT, type Action, type ActionContext, type ActionEngine, type ActionHandler, type ActionResult, ActionRunner, type AttackEvent, AttackHandler, type BaseEvent, type BlockingComponent, type CollectibleComponent, type CollisionComponent, type CombatComponent, type Commander, type ComponentMap, type ComponentType, type CooldownComponent, type CustomEvent, DEFAULT_MAX_FRAMES, type DamageEvent, type DeathEvent, type Engine, type Entity, type EntityId, type Event, FrameDriver, type FrameDriverOption, type FrameEvents, type GameEvent, type Grader, type HealthComponent, type InventoryComponent, type LevelDef, type LevelValidator, type LogEvent, type MotionComponent, type MoveBlockedEvent, MoveDirectionHandler, type MoveEvent, type MovementComponent, MovementSystem, type MultiFrameActionHandler, MultiFrameActionRunner, type MultiFrameActionState, type MultiFrameActionStatus, type MultiFrameActionStepResult, type MultiFrameActionTickResult, type ObjectiveCompletedEvent, type ObjectiveCondition, type ObjectiveEvaluator, ObjectiveSystem, type ObjectiveTargetComponent, type Order, type Outcome, PickUpHandler, type PickupEvent, type PlanIterator, PlanRunner, type PlanRunnerOptions, type PlanRunnerState, type PlanRunnerTickResult, type PlanStep, type PlanYield, type PositionComponent, type ProgrammableComponent, RNG, type Replay, type ReplayMetadata, type ScoreEvent, type Solvable, type State, type System, SystemRunner, type TeamComponent, UNIT, type ValidationResult, type Vec2, WaitHandler, type WorldBounds, type WorldEngine, type WorldFrame, WorldRunner, type WorldRunnerOptions, type WorldRunnerResult, type WorldState, YieldPlanRunner, type YieldPlanRunnerState, type YieldPlanRunnerTickResult, add, addEntity, buildReplay, captureWorldFrame, createWorld, distance, findNearest, getBlockingEntities, getComponent, getEntity, hasComponent, isInBounds, isOccupied, isPathClear, isPositionInBounds, isSegmentClear, isqrt, len, len2, moveToward, removeComponent, removeEntity, scale, setComponent, sub, tile, toOutcomeJSON, toReplayJSON, updateEntity, visibleEntities, withComponent, withDecisionInterval, withMaxFrames, withoutComponent };
