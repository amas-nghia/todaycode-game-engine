import { E as Engine, L as LevelDef } from './gamecore.interface-B670b_Xv.js';

declare const GridWidth = 12;
declare const GridHeight = 9;
declare const MaxTicks = 200;
declare const FRAMES_PER_TICK = 3;
declare const MaxFrames: number;
declare const TreeBearFruitAge = 6;
declare const GiftInterval = 10;
declare const GiftRewardPoints = 5;
declare const MidCol = 5;
declare const RightEdge = 11;
type Direction = 'up' | 'down' | 'left' | 'right' | 'stay';
declare const ValidDirections: Record<string, boolean>;
declare const DirectionDeltas: Record<Direction, {
    x: number;
    y: number;
}>;
declare const ACTOR_STATS: {
    readonly planter: {
        readonly hp: 6;
        readonly maxHp: 6;
        readonly atk: 1;
        readonly speed: 1;
        readonly carry: 0;
    };
    readonly harvester: {
        readonly hp: 3;
        readonly maxHp: 3;
        readonly atk: 0;
        readonly speed: 3;
        readonly carry: 3;
    };
    readonly worm: {
        readonly hp: 4;
        readonly maxHp: 4;
        readonly atk: 3;
        readonly speed: 2;
        readonly carry: 0;
    };
};
declare const SPEED_SCHEDULES: Record<number, number[]>;

type TeamID = 1 | 2;
type ActorType = 'planter' | 'harvester' | 'worm';
type GiftChoice = 0 | 1 | 2 | 3;
interface Position {
    x: number;
    y: number;
}
interface GiftBox {
    id: number;
    x: number;
    y: number;
    spawnedTurn: number;
}
interface ActorStats {
    hp: number;
    maxHp: number;
    atk: number;
    speed: number;
    carry: number;
}
interface Actor {
    type: ActorType;
    x: number;
    y: number;
    cooldown: number;
    baseIndex: number;
    inventory: number;
    stats: ActorStats;
    slowDebuffTicks: number;
    respawnIn: number;
    droppedFruits: number;
}
interface Tree {
    id: number;
    x: number;
    y: number;
    team: TeamID;
    age: number;
    fruits: number;
}
interface TeamState {
    id: TeamID;
    bases: Position[];
    score: number;
    actors: Actor[];
}
interface FarmWarsState {
    turn: number;
    team1: TeamState;
    team2: TeamState;
    trees: Tree[];
    gifts: GiftBox[];
    seed: number;
    nextTreeId: number;
    nextGiftId: number;
}

type FarmWarsEvent = {
    type: 'tree_plant';
    team: TeamID;
    pos: Position;
    treeId: number;
} | {
    type: 'harvest';
    team: TeamID;
    actorIndex: number;
    treePos: Position;
    fruitsPicked: number;
} | {
    type: 'tree_destroy';
    wormTeam: TeamID;
    treePos: Position;
    treeId: number;
    treeTeam: TeamID;
} | {
    type: 'harvester_reset';
    team: TeamID;
    actorIndex: number;
    toPos: Position;
    inventoryLost: number;
} | {
    type: 'worm_reset';
    team: TeamID;
    actorIndex: number;
    toPos: Position;
} | {
    type: 'collision_worm_harv';
    wormTeam: TeamID;
    harvesterTeam: TeamID;
    fruitsStolen: number;
    harvesterPos: Position;
} | {
    type: 'planter_vs_worm';
    planterTeam: TeamID;
    wormTeam: TeamID;
    wormPos: Position;
} | {
    type: 'fruit_grow';
    treeId: number;
    pos: Position;
    newFruits: number;
} | {
    type: 'score';
    team: TeamID;
    delta: number;
    reason: 'worm_steal' | 'harvest_deposit' | 'gift_reward';
} | {
    type: 'gift_expire';
    ids: number[];
} | {
    type: 'gift_spawn';
    gifts: GiftBox[];
} | {
    type: 'gift_pickup';
    team: TeamID;
    choice: GiftChoice;
    pos: Position;
} | {
    type: 'combat';
    team1: TeamID;
    actor1: number;
    team2: TeamID;
    actor2: number;
    pos: Position;
    dmg1: number;
    dmg2: number;
    newHp1: number;
    newHp2: number;
} | {
    type: 'unit_death';
    team: TeamID;
    actorIndex: number;
    pos: Position;
    actorType: ActorType;
} | {
    type: 'unit_respawn';
    team: TeamID;
    actorIndex: number;
    pos: Position;
    actorType: ActorType;
} | {
    type: 'fruit_drop';
    team: TeamID;
    actorIndex: number;
    pos: Position;
    amount: number;
} | {
    type: 'debuff_applied';
    team: TeamID;
    actorIndex: number;
    debuff: string;
} | {
    type: 'debuff_expired';
    team: TeamID;
    actorIndex: number;
    debuff: string;
} | {
    type: 'move';
    team: TeamID;
    actorIndex: number;
    toPos: Position;
};

interface Actions {
    directions: Direction[];
    giftChoice: GiftChoice;
    baseSetup?: [number, number, number];
}
declare function parseActions(rawLines: string[], actorCount: number): Actions;

declare const team1Bases: Position[];
declare const team2Bases: Position[];
declare function createInitialState(seed: number): FarmWarsState;
declare function applyBaseSetup(team: TeamState, setup: [number, number, number]): TeamState;

declare const goldenGamma = 2654435761;
declare function mulberry32(seed: number): () => number;
declare function giftPositionsForTurn(seed: number, turn: number, team1Bases: Position[]): [Position, Position];

declare function resolveCombat(state: FarmWarsState, events: FarmWarsEvent[]): void;

declare function handleDeposits(state: FarmWarsState, events: FarmWarsEvent[]): void;

declare function applyTick(state: FarmWarsState, frame: number, actions1: Actions, actions2: Actions): {
    state: FarmWarsState;
    events: FarmWarsEvent[];
};

/**
 * Per-side wire serialization — port of Go wire.go.
 *
 * Renders a JSON dict from one side's perspective: my_team/enemy_team with
 * information hiding (enemy harvester inventory hidden). The shape matches
 * what the Python harness main.py's _dispatch() reads.
 */

/**
 * Serializes the game state from one side's perspective.
 * Returns a JSON string ready to send to the bot process.
 */
declare function serializeForSide(state: FarmWarsState, perspective: TeamID): string;
/**
 * Legacy wireState — kept for backward compatibility with existing tests.
 * New code should use serializeForSide.
 */
declare function wireState(state: FarmWarsState, events: unknown[]): unknown;

declare class FarmWarsEngine implements Engine {
    name(): string;
    version(): string;
    init(level: LevelDef, seed: number): FarmWarsState;
    applyOrders(state: FarmWarsState, agentId: number, orders: string[]): FarmWarsState;
    tick(state: FarmWarsState, frame: number): {
        state: FarmWarsState;
        events: FarmWarsEvent[];
    };
    isOver(state: FarmWarsState): boolean;
    result(state: FarmWarsState): any;
    formatState(state: FarmWarsState, events: any[]): string;
}

/**
 * Event-log replay — the client-side half of the keyframe + event-delta
 * replay architecture. Given a state and the events *this engine already
 * produced* for one frame (see tick.ts), derive the next state without
 * re-deriving any game rule (movement, combat, harvest math, gift RNG...) —
 * that already happened once, here, when the event was created.
 *
 * Every case below was checked directly against tick.ts / combat.ts's own
 * event-construction sites, not inferred from field names alone — except
 * `harvester_reset` and `collision_worm_harv`, marked below, which follow the
 * same "write the event's own fields directly" pattern every verified case
 * uses, but weren't individually re-derived line-by-line. The parity test
 * (replaying a real captured match end-to-end and comparing final scores)
 * is the intended net for exactly that gap.
 */

/**
 * Applies every event of one frame in order, returning the next state.
 * Does not mutate the input state.
 */
declare function applyFrame(state: FarmWarsState, events: FarmWarsEvent[]): FarmWarsState;
declare function applyEvent(prev: FarmWarsState, event: FarmWarsEvent): FarmWarsState;

export { ACTOR_STATS, type Actions, type Actor, type ActorStats, type ActorType, type Direction, DirectionDeltas, FRAMES_PER_TICK, FarmWarsEngine, type FarmWarsEvent, type FarmWarsState, type GiftBox, type GiftChoice, GiftInterval, GiftRewardPoints, GridHeight, GridWidth, MaxFrames, MaxTicks, MidCol, type Position, RightEdge, SPEED_SCHEDULES, type TeamID, type TeamState, type Tree, TreeBearFruitAge, ValidDirections, applyBaseSetup, applyEvent, applyFrame, applyTick, createInitialState, giftPositionsForTurn, goldenGamma, handleDeposits, mulberry32, parseActions, resolveCombat, serializeForSide, team1Bases, team2Bases, wireState };
