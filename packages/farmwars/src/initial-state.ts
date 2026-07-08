import {
  Position,
  TeamID,
  TeamState,
  ActorType,
  Actor,
  FarmWarsState,
} from './state';
import { ACTOR_STATS } from './constants';

export const team1Bases: Position[] = [
  { x: 0, y: 1 },
  { x: 0, y: 4 },
  { x: 0, y: 7 },
];

export const team2Bases: Position[] = [
  { x: 11, y: 1 },
  { x: 11, y: 4 },
  { x: 11, y: 7 },
];

function makeTeam(id: TeamID, bases: Position[]): TeamState {
  const types: ActorType[] = ['planter', 'harvester', 'worm'];
  const actors: Actor[] = types.map((t, i) => {
    const b = bases[i];
    return {
      type: t,
      x: b.x,
      y: b.y,
      cooldown: 0,
      baseIndex: i,
      inventory: 0,
      stats: { ...ACTOR_STATS[t] },
      slowDebuffTicks: 0,
      respawnIn: 0,
      droppedFruits: 0,
    };
  });

  return {
    id,
    bases: [...bases],
    score: 0,
    actors,
  };
}

export function createInitialState(seed: number): FarmWarsState {
  return {
    turn: 0,
    team1: makeTeam(1, team1Bases),
    team2: makeTeam(2, team2Bases),
    trees: [],
    gifts: [],
    seed,
    nextTreeId: 1,
    nextGiftId: 1,
  };
}

export function applyBaseSetup(
  team: TeamState,
  setup: [number, number, number],
): TeamState {
  const maxIdx = team.bases.length - 1;
  const actors = team.actors.map((actor, i) => {
    if (i >= 3) return actor;
    let idx = setup[i];
    if (idx < 0) idx = 0;
    else if (idx > maxIdx) idx = maxIdx;

    const b = team.bases[idx];
    return {
      ...actor,
      baseIndex: idx,
      x: b.x,
      y: b.y,
    };
  });

  return { ...team, actors };
}
