import { Engine, LevelDef } from '../../gamecore/src';
import { createInitialState } from './initial-state';
import { parseActions } from './orders';
import { applyTick } from './tick';
import { FarmWarsState } from './state';
import { FarmWarsEvent } from './events';
import { wireState } from './wire';
import { MaxFrames } from './constants';

export class FarmWarsEngine implements Engine {
  name(): string {
    return 'farm-wars';
  }

  version(): string {
    return '2.0.0'; // Updated to v2 per spec
  }

  init(level: LevelDef, seed: number): FarmWarsState {
    return createInitialState(seed);
  }

  applyOrders(
    state: FarmWarsState,
    agentId: number,
    orders: string[],
  ): FarmWarsState {
    const actions = parseActions(orders, 3);
    if (!state.hasOwnProperty('__actions')) {
      (state as any).__actions = {};
    }
    (state as any).__actions[agentId] = actions;
    return state;
  }

  tick(
    state: FarmWarsState,
    frame: number,
  ): { state: FarmWarsState; events: FarmWarsEvent[] } {
    const actionsMap = (state as any).__actions || {};
    const actions1 = actionsMap[1] || parseActions([], 3);
    const actions2 = actionsMap[2] || parseActions([], 3);

    const isEndOfTick = frame % 3 === 2;
    if (isEndOfTick) {
      // Clear the stored actions for the next decision frame
      (state as any).__actions = {};
    }

    return applyTick(state, frame, actions1, actions2);
  }

  isOver(state: FarmWarsState): boolean {
    if (state.turn >= MaxFrames / 3) return true;

    // Annihilation check: All units of a team are dead (respawnIn > 0)
    const isTeam1Dead = state.team1.actors.every((a) => a.respawnIn > 0);
    const isTeam2Dead = state.team2.actors.every((a) => a.respawnIn > 0);

    return isTeam1Dead || isTeam2Dead;
  }

  result(state: FarmWarsState): any {
    const isTeam1Dead = state.team1.actors.every((a) => a.respawnIn > 0);
    const isTeam2Dead = state.team2.actors.every((a) => a.respawnIn > 0);

    let winner = 0;
    if (isTeam1Dead && !isTeam2Dead) winner = 2;
    else if (isTeam2Dead && !isTeam1Dead) winner = 1;
    else if (state.team1.score > state.team2.score) winner = 1;
    else if (state.team2.score > state.team1.score) winner = 2;

    return {
      winner,
      scores: {
        1: state.team1.score,
        2: state.team2.score,
      },
    };
  }

  formatState(state: FarmWarsState, events: any[]): string {
    return JSON.stringify(wireState(state, events));
  }
}
