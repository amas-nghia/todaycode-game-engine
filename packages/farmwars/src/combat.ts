import { FarmWarsState, TeamID } from './state';
import { FarmWarsEvent } from './events';

export function resolveCombat(state: FarmWarsState, events: FarmWarsEvent[]) {
  const actors1 = state.team1.actors;
  const actors2 = state.team2.actors;

  for (let i = 0; i < actors1.length; i++) {
    const a1 = actors1[i];
    if (a1.respawnIn > 0) continue; // dead

    for (let j = 0; j < actors2.length; j++) {
      const a2 = actors2[j];
      if (a2.respawnIn > 0) continue; // dead

      if (a1.x === a2.x && a1.y === a2.y) {
        // Simultaneous combat
        const dmg1 = a2.stats.atk;
        const dmg2 = a1.stats.atk;

        a1.stats.hp -= dmg1;
        a2.stats.hp -= dmg2;

        events.push({
          type: 'combat',
          team1: 1,
          actor1: i,
          team2: 2,
          actor2: j,
          pos: { x: a1.x, y: a1.y },
          dmg1,
          dmg2,
          newHp1: a1.stats.hp,
          newHp2: a2.stats.hp,
        });
      }
    }
  }

  // Handle deaths
  handleDeaths(1, actors1, events);
  handleDeaths(2, actors2, events);
}

function handleDeaths(team: TeamID, actors: any[], events: FarmWarsEvent[]) {
  for (let i = 0; i < actors.length; i++) {
    const a = actors[i];
    if (a.respawnIn === 0 && a.stats.hp <= 0) {
      a.stats.hp = 0;
      a.respawnIn = Math.trunc((a.stats.maxHp + 1) / 2); // ceil(maxHp/2) logic for integers: trunc((n+1)/2)

      events.push({
        type: 'unit_death',
        team,
        actorIndex: i,
        pos: { x: a.x, y: a.y },
        actorType: a.type,
      });

      // Harvester drops fruits
      if (a.type === 'harvester' && a.inventory > 0) {
        a.droppedFruits = a.inventory;
        a.inventory = 0;
        events.push({
          type: 'fruit_drop',
          team,
          actorIndex: i,
          pos: { x: a.x, y: a.y },
          amount: a.droppedFruits,
        });
      }
    }
  }
}
