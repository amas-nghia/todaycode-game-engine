import { FarmWarsState, TeamState } from './state';
import { FarmWarsEvent } from './events';

export function handleDeposits(state: FarmWarsState, events: FarmWarsEvent[]) {
  processTeamDeposits(state.team1, events);
  processTeamDeposits(state.team2, events);
}

function processTeamDeposits(team: TeamState, events: FarmWarsEvent[]) {
  for (let i = 0; i < team.actors.length; i++) {
    const a = team.actors[i];
    if (a.respawnIn > 0) continue;

    // Harvester deposits at any of its team's bases
    if (a.type === 'harvester' && a.inventory > 0) {
      const onBase = team.bases.some((b) => b.x === a.x && b.y === a.y);
      if (onBase) {
        team.score += a.inventory;
        events.push({
          type: 'score',
          team: team.id,
          delta: a.inventory,
          reason: 'harvest_deposit',
        });
        a.inventory = 0;
      }
    }
  }
}
