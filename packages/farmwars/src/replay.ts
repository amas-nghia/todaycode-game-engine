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
import { FarmWarsEvent } from './events';
import { FarmWarsState, TeamID, Tree, Actor } from './state';

function team(state: FarmWarsState, id: TeamID) {
  return id === 1 ? state.team1 : state.team2;
}

/** Structural clone via JSON — state is plain-data only (no functions, no Date, no Map/Set). */
function cloneState(state: FarmWarsState): FarmWarsState {
  return JSON.parse(JSON.stringify(state));
}

function findActor(state: FarmWarsState, id: TeamID, actorIndex: number): Actor {
  return team(state, id).actors[actorIndex];
}

function findActorByPos(state: FarmWarsState, id: TeamID, x: number, y: number): Actor | undefined {
  return team(state, id).actors.find((a) => a.x === x && a.y === y);
}

function findTreeById(state: FarmWarsState, treeId: number): Tree | undefined {
  return state.trees.find((t) => t.id === treeId);
}

/**
 * Applies every event of one frame in order, returning the next state.
 * Does not mutate the input state.
 */
export function applyFrame(state: FarmWarsState, events: FarmWarsEvent[]): FarmWarsState {
  return events.reduce(applyEvent, state);
}

export function applyEvent(prev: FarmWarsState, event: FarmWarsEvent): FarmWarsState {
  const state = cloneState(prev);

  switch (event.type) {
    case 'move': {
      const actor = findActor(state, event.team, event.actorIndex);
      actor.x = event.toPos.x;
      actor.y = event.toPos.y;
      return state;
    }

    case 'tree_plant': {
      state.trees.push({
        id: event.treeId,
        x: event.pos.x,
        y: event.pos.y,
        team: event.team,
        age: 0,
        fruits: 0,
      });
      return state;
    }

    case 'harvest': {
      const tree = findTreeByPos(state, event.treePos);
      if (tree) tree.fruits = 0;
      const actor = findActor(state, event.team, event.actorIndex);
      actor.inventory += event.fruitsPicked;
      return state;
    }

    case 'tree_destroy': {
      state.trees = state.trees.filter((t) => t.id !== event.treeId);
      return state;
    }

    case 'harvester_reset': {
      // Verify against tick.ts before relying on this in production — see file header.
      const actor = findActor(state, event.team, event.actorIndex);
      actor.x = event.toPos.x;
      actor.y = event.toPos.y;
      actor.inventory = 0;
      return state;
    }

    case 'worm_reset': {
      const actor = findActor(state, event.team, event.actorIndex);
      actor.x = event.toPos.x;
      actor.y = event.toPos.y;
      return state;
    }

    case 'collision_worm_harv': {
      // Verify against tick.ts before relying on this in production — see file header.
      const harvester = findActorByPos(state, event.harvesterTeam, event.harvesterPos.x, event.harvesterPos.y);
      if (harvester) harvester.inventory = Math.max(0, harvester.inventory - event.fruitsStolen);
      return state;
    }

    case 'planter_vs_worm': {
      // Dead in the current engine (never constructed in tick.ts/combat.ts) — see the
      // companion implementation plan's Phase 0 audit. No-op, kept for exhaustiveness.
      return state;
    }

    case 'fruit_grow': {
      const tree = findTreeById(state, event.treeId);
      if (tree) tree.fruits = event.newFruits;
      return state;
    }

    case 'score': {
      team(state, event.team).score += event.delta;
      return state;
    }

    case 'gift_expire': {
      const ids = new Set(event.ids);
      state.gifts = state.gifts.filter((g) => !ids.has(g.id));
      return state;
    }

    case 'gift_spawn': {
      state.gifts.push(...event.gifts);
      return state;
    }

    case 'gift_pickup': {
      const idx = state.gifts.findIndex((g) => g.x === event.pos.x && g.y === event.pos.y);
      if (idx !== -1) state.gifts.splice(idx, 1);
      return state;
    }

    case 'combat': {
      findActor(state, event.team1, event.actor1).stats.hp = event.newHp1;
      findActor(state, event.team2, event.actor2).stats.hp = event.newHp2;
      return state;
    }

    case 'unit_death': {
      const actor = findActor(state, event.team, event.actorIndex);
      actor.stats.hp = 0;
      actor.respawnIn = Math.trunc((actor.stats.maxHp + 1) / 2);
      return state;
    }

    case 'unit_respawn': {
      const actor = findActor(state, event.team, event.actorIndex);
      actor.x = event.pos.x;
      actor.y = event.pos.y;
      actor.stats.hp = actor.stats.maxHp;
      return state;
    }

    case 'fruit_drop': {
      const actor = findActor(state, event.team, event.actorIndex);
      actor.droppedFruits = event.amount;
      actor.inventory = 0;
      return state;
    }

    case 'debuff_applied': {
      // Only debuff in the current engine is the venomous-bite slow (3 ticks) — see tick.ts.
      const actor = findActor(state, event.team, event.actorIndex);
      actor.slowDebuffTicks = 3;
      return state;
    }

    case 'debuff_expired': {
      const actor = findActor(state, event.team, event.actorIndex);
      actor.slowDebuffTicks = 0;
      return state;
    }

    default: {
      const _exhaustive: never = event;
      return state;
    }
  }
}

function findTreeByPos(state: FarmWarsState, pos: { x: number; y: number }): Tree | undefined {
  return state.trees.find((t) => t.x === pos.x && t.y === pos.y);
}
