/**
 * Per-side wire serialization — port of Go wire.go.
 *
 * Renders a JSON dict from one side's perspective: my_team/enemy_team with
 * information hiding (enemy harvester inventory hidden). The shape matches
 * what the Python harness main.py's _dispatch() reads.
 */
import type { FarmWarsState, TeamState, Actor, TeamID } from './state';
import { GridWidth, GridHeight, MaxTicks } from './constants';

// ── Wire shapes (snake_case JSON keys matching FE/Go) ───────────────────────

interface WireActor {
  type: string;
  x: number;
  y: number;
  cooldown: number;
  baseIndex: number;
  inventory?: number;
  // v2 additions
  stats: {
    hp: number;
    maxHp: number;
    atk: number;
    speed: number;
    carry: number;
  };
  debuffs: string[];
  respawnIn: number;
}

interface WireTeam {
  id: TeamID;
  bases: { x: number; y: number }[];
  score: number;
  actors: WireActor[];
}

interface WireTree {
  x: number;
  y: number;
  team: TeamID;
  age: number;
  fruits: number;
}

interface WireGift {
  x: number;
  y: number;
}

interface WireGrid {
  width: number;
  height: number;
  trees: WireTree[];
}

interface WireState {
  turn: number;
  max_turns: number;
  my_side: TeamID;
  my_team: WireTeam;
  enemy_team: WireTeam;
  grid: WireGrid;
  gifts: WireGift[];
}

function toWireTeam(team: TeamState, hideInventory: boolean): WireTeam {
  const actors: WireActor[] = team.actors.map((a: Actor) => {
    const wa: WireActor = {
      type: a.type,
      x: a.x,
      y: a.y,
      cooldown: a.cooldown,
      baseIndex: a.baseIndex,
      stats: {
        hp: a.stats.hp,
        maxHp: a.stats.maxHp,
        atk: a.stats.atk,
        speed: a.stats.speed,
        carry: a.stats.carry,
      },
      debuffs: a.slowDebuffTicks > 0 ? ['venomous_bite'] : [],
      respawnIn: a.respawnIn,
    };
    // Only expose inventory for own team's harvesters
    if (a.type === 'harvester' && !hideInventory) {
      wa.inventory = a.inventory;
    }
    return wa;
  });
  const bases = team.bases.map((b) => ({ x: b.x, y: b.y }));
  return { id: team.id, bases, score: team.score, actors };
}

/**
 * Serializes the game state from one side's perspective.
 * Returns a JSON string ready to send to the bot process.
 */
export function serializeForSide(
  state: FarmWarsState,
  perspective: TeamID,
): string {
  const myTeam = perspective === 1 ? state.team1 : state.team2;
  const enemyTeam = perspective === 1 ? state.team2 : state.team1;

  const trees: WireTree[] = state.trees.map((t) => ({
    x: t.x,
    y: t.y,
    team: t.team,
    age: t.age,
    fruits: t.fruits,
  }));

  const gifts: WireGift[] = state.gifts.map((g) => ({ x: g.x, y: g.y }));

  const wire: WireState = {
    turn: state.turn,
    max_turns: MaxTicks,
    my_side: perspective,
    my_team: toWireTeam(myTeam, false),
    enemy_team: toWireTeam(enemyTeam, true),
    grid: { width: GridWidth, height: GridHeight, trees },
    gifts,
  };

  return JSON.stringify(wire);
}

/**
 * Legacy wireState — kept for backward compatibility with existing tests.
 * New code should use serializeForSide.
 */
export function wireState(state: FarmWarsState, events: unknown[]): unknown {
  return {
    state,
    events,
  };
}
