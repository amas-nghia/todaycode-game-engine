import {
  FarmWarsState,
  TeamState,
  TeamID,
  Tree,
  GiftChoice,
  GiftBox,
} from './state';
import { Actions } from './orders';
import { FarmWarsEvent } from './events';
import {
  FRAMES_PER_TICK,
  SPEED_SCHEDULES,
  DirectionDeltas,
  GridWidth,
  GridHeight,
  TreeBearFruitAge,
  GiftInterval,
} from './constants';
import { handleDeposits } from './scoring';
import { giftPositionsForTurn } from './gift-rng';

function inGrid(x: number, y: number): boolean {
  return x >= 0 && x < GridWidth && y >= 0 && y < GridHeight;
}

function onAnyBase(x: number, y: number, state: FarmWarsState): boolean {
  for (const b of state.team1.bases) if (b.x === x && b.y === y) return true;
  for (const b of state.team2.bases) if (b.x === x && b.y === y) return true;
  return false;
}

function treeIndexAt(trees: Tree[], x: number, y: number): number {
  return trees.findIndex((t) => t.x === x && t.y === y);
}

export function applyTick(
  state: FarmWarsState,
  frame: number,
  actions1: Actions,
  actions2: Actions,
): { state: FarmWarsState; events: FarmWarsEvent[] } {
  const events: FarmWarsEvent[] = [];
  const offset = frame % FRAMES_PER_TICK;
  const isEndOfTick = offset === FRAMES_PER_TICK - 1;

  // Turn 0 Base Setup
  if (frame === 0) {
    if (actions1.baseSetup) applyBaseSetup(state.team1, actions1.baseSetup);
    if (actions2.baseSetup) applyBaseSetup(state.team2, actions2.baseSetup);
  }

  // Respawns handled at the end of the tick

  // 1. Movement & Auto-actions for this frame
  processMovementAndAutoActions(state, 1, actions1, offset, events);
  processMovementAndAutoActions(state, 2, actions2, offset, events);

  // 2. Combat (Simultaneous)
  resolveCombat(state, events);

  // End of Tick phases
  if (isEndOfTick) {
    // a. Respawns & Debuffs
    processEndOfTickRespawnsAndDebuffs(state, 1, events);
    processEndOfTickRespawnsAndDebuffs(state, 2, events);

    // b. Tree lifecycle
    ageTrees(state, events);

    // c. Deposit
    handleDeposits(state, events);

    // d. Cooldowns (from v1)
    decrementCooldowns(state.team1);
    decrementCooldowns(state.team2);

    // e. Gift phases
    state.turn++;
    expireGifts(state, events);
    spawnGifts(state, events);
    resolveGiftPickups(state, actions1.giftChoice, actions2.giftChoice, events);
  }

  return { state, events };
}

function applyBaseSetup(team: TeamState, setup: [number, number, number]) {
  const maxIdx = team.bases.length - 1;
  for (let i = 0; i < 3 && i < team.actors.length; i++) {
    let idx = setup[i];
    if (idx < 0) idx = 0;
    else if (idx > maxIdx) idx = maxIdx;
    team.actors[i].baseIndex = idx;
    team.actors[i].x = team.bases[idx].x;
    team.actors[i].y = team.bases[idx].y;
  }
}

function processMovementAndAutoActions(
  state: FarmWarsState,
  teamId: TeamID,
  actions: Actions,
  offset: number,
  events: FarmWarsEvent[],
) {
  const team = teamId === 1 ? state.team1 : state.team2;

  for (let i = 0; i < team.actors.length; i++) {
    const actor = team.actors[i];
    if (actor.respawnIn > 0) continue;

    const actualSpeed = Math.max(
      1,
      actor.stats.speed - (actor.slowDebuffTicks > 0 ? 1 : 0),
    );
    const schedule = SPEED_SCHEDULES[actualSpeed] || SPEED_SCHEDULES[1];

    if (!schedule.includes(offset)) continue;

    // Movement
    const dir = actions.directions[i] || 'stay';
    if (dir !== 'stay' && actor.cooldown === 0) {
      const delta = DirectionDeltas[dir];
      const targetX = actor.x + delta.x;
      const targetY = actor.y + delta.y;

      let valid = inGrid(targetX, targetY);
      if (
        valid &&
        (actor.type === 'planter' || actor.type === 'worm') &&
        onAnyBase(targetX, targetY, state)
      ) {
        valid = false;
      }

      if (valid) {
        actor.x = targetX;
        actor.y = targetY;
        events.push({
          type: 'move',
          team: teamId,
          actorIndex: i,
          toPos: { x: targetX, y: targetY },
        });
      }
    }

    // Auto actions
    if (actor.type === 'planter' && !onAnyBase(actor.x, actor.y, state)) {
      if (treeIndexAt(state.trees, actor.x, actor.y) === -1) {
        const treeId = state.nextTreeId++;
        state.trees.push({
          id: treeId,
          x: actor.x,
          y: actor.y,
          team: teamId,
          age: 0,
          fruits: 0,
        });
        events.push({
          type: 'tree_plant',
          team: teamId,
          pos: { x: actor.x, y: actor.y },
          treeId,
        });
      }
    } else if (actor.type === 'harvester') {
      const idx = treeIndexAt(state.trees, actor.x, actor.y);
      if (
        idx !== -1 &&
        state.trees[idx].team === teamId &&
        state.trees[idx].fruits > 0
      ) {
        const picked = state.trees[idx].fruits;
        state.trees[idx].fruits = 0;
        actor.inventory += picked;
        events.push({
          type: 'harvest',
          team: teamId,
          actorIndex: i,
          treePos: { x: actor.x, y: actor.y },
          fruitsPicked: picked,
        });
      }
    } else if (actor.type === 'worm') {
      const idx = treeIndexAt(state.trees, actor.x, actor.y);
      if (idx !== -1 && state.trees[idx].team !== teamId) {
        events.push({
          type: 'tree_destroy',
          wormTeam: teamId,
          treePos: { x: actor.x, y: actor.y },
          treeId: state.trees[idx].id,
          treeTeam: state.trees[idx].team,
        });
        state.trees.splice(idx, 1);
      }
    }
  }
}

function resolveCombat(state: FarmWarsState, events: FarmWarsEvent[]) {
  const actors1 = state.team1.actors;
  const actors2 = state.team2.actors;

  for (let i = 0; i < actors1.length; i++) {
    const a1 = actors1[i];
    if (a1.respawnIn > 0) continue;

    for (let j = 0; j < actors2.length; j++) {
      const a2 = actors2[j];
      if (a2.respawnIn > 0) continue;

      if (a1.x === a2.x && a1.y === a2.y) {
        let dmg1 = a2.stats.atk;
        let dmg2 = a1.stats.atk;

        // Farmer Root Shield: -2 damage taken if standing on own tree
        if (a1.type === 'planter') {
          const t1 = treeIndexAt(state.trees, a1.x, a1.y);
          if (t1 !== -1 && state.trees[t1].team === 1)
            dmg1 = Math.max(0, dmg1 - 2);
        }
        if (a2.type === 'planter') {
          const t2 = treeIndexAt(state.trees, a2.x, a2.y);
          if (t2 !== -1 && state.trees[t2].team === 2)
            dmg2 = Math.max(0, dmg2 - 2);
        }

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

        // Venomous Bite: speed -1 for 3 ticks
        if (a1.type === 'worm' && dmg2 > 0) {
          a2.slowDebuffTicks = 3;
          events.push({
            type: 'debuff_applied',
            team: 2,
            actorIndex: j,
            debuff: 'slow',
          });
        }
        if (a2.type === 'worm' && dmg1 > 0) {
          a1.slowDebuffTicks = 3;
          events.push({
            type: 'debuff_applied',
            team: 1,
            actorIndex: i,
            debuff: 'slow',
          });
        }
      }
    }
  }

  handleDeaths(1, state.team1, events);
  handleDeaths(2, state.team2, events);
}

function handleDeaths(
  teamId: TeamID,
  team: TeamState,
  events: FarmWarsEvent[],
) {
  for (let i = 0; i < team.actors.length; i++) {
    const a = team.actors[i];
    if (a.respawnIn === 0 && a.stats.hp <= 0) {
      a.stats.hp = 0;
      a.respawnIn = Math.trunc((a.stats.maxHp + 1) / 2);
      a.slowDebuffTicks = 0; // clear debuffs on death
      events.push({
        type: 'unit_death',
        team: teamId,
        actorIndex: i,
        pos: { x: a.x, y: a.y },
        actorType: a.type,
      });

      if (a.type === 'harvester' && a.inventory > 0) {
        a.droppedFruits = a.inventory;
        a.inventory = 0;
        events.push({
          type: 'fruit_drop',
          team: teamId,
          actorIndex: i,
          pos: { x: a.x, y: a.y },
          amount: a.droppedFruits,
        });
      }
    }
  }
}

function processEndOfTickRespawnsAndDebuffs(
  state: FarmWarsState,
  teamId: TeamID,
  events: FarmWarsEvent[],
) {
  const team = teamId === 1 ? state.team1 : state.team2;
  for (let i = 0; i < team.actors.length; i++) {
    const a = team.actors[i];

    // Decrement Debuffs
    if (a.slowDebuffTicks > 0) {
      a.slowDebuffTicks--;
      if (a.slowDebuffTicks === 0) {
        events.push({
          type: 'debuff_expired',
          team: teamId,
          actorIndex: i,
          debuff: 'slow',
        });
      }
    }

    // Handle Respawn
    if (a.respawnIn > 0) {
      a.respawnIn--;
      if (a.respawnIn === 0) {
        const base = team.bases[a.baseIndex];
        a.x = base.x;
        a.y = base.y;
        a.stats.hp = a.stats.maxHp;
        events.push({
          type: 'unit_respawn',
          team: teamId,
          actorIndex: i,
          pos: { x: a.x, y: a.y },
          actorType: a.type,
        });
      }
    }
  }
}

function ageTrees(state: FarmWarsState, events: FarmWarsEvent[]) {
  for (const t of state.trees) {
    t.age++;
    const natural = t.age >= TreeBearFruitAge ? 1 : 0;
    const newFruits = Math.max(natural, t.fruits);
    if (newFruits !== t.fruits) {
      events.push({
        type: 'fruit_grow',
        treeId: t.id,
        pos: { x: t.x, y: t.y },
        newFruits,
      });
    }
    t.fruits = newFruits;
  }
}

function decrementCooldowns(team: TeamState) {
  for (const a of team.actors) {
    a.cooldown = Math.max(0, a.cooldown - 1);
  }
}

function expireGifts(state: FarmWarsState, events: FarmWarsEvent[]) {
  const expired: number[] = [];
  state.gifts = state.gifts.filter((g) => {
    if (state.turn - g.spawnedTurn >= GiftInterval) {
      expired.push(g.id);
      return false;
    }
    return true;
  });
  if (expired.length > 0) {
    events.push({ type: 'gift_expire', ids: expired });
  }
}

function spawnGifts(state: FarmWarsState, events: FarmWarsEvent[]) {
  if (state.turn % GiftInterval !== 0) return;
  const [pA, pB] = giftPositionsForTurn(
    state.seed,
    state.turn,
    state.team1.bases,
  );
  const boxA: GiftBox = {
    id: state.nextGiftId,
    x: pA.x,
    y: pA.y,
    spawnedTurn: state.turn,
  };
  const boxB: GiftBox = {
    id: state.nextGiftId + 1,
    x: pB.x,
    y: pB.y,
    spawnedTurn: state.turn,
  };
  state.gifts.push(boxA, boxB);
  state.nextGiftId += 2;
  events.push({ type: 'gift_spawn', gifts: [boxA, boxB] });
}

function resolveGiftPickups(
  state: FarmWarsState,
  c1: GiftChoice,
  c2: GiftChoice,
  events: FarmWarsEvent[],
) {
  const consumed = new Set<number>();

  const pickup = (
    teamId: TeamID,
    team: TeamState,
    enemy: TeamState,
    choice: GiftChoice,
  ) => {
    for (const a of team.actors) {
      for (const g of state.gifts) {
        if (consumed.has(g.id) || g.x !== a.x || g.y !== a.y) continue;
        events.push({
          type: 'gift_pickup',
          team: teamId,
          choice,
          pos: { x: g.x, y: g.y },
        });
        consumed.add(g.id);
        if (choice !== 0) {
          applyGiftEffect(team, enemy, choice, events);
        }
        break; // one actor picks up one gift
      }
    }
  };

  pickup(1, state.team1, state.team2, c1);
  pickup(2, state.team2, state.team1, c2);

  state.gifts = state.gifts.filter((g) => !consumed.has(g.id));
}

function applyGiftEffect(
  team: TeamState,
  enemy: TeamState,
  choice: GiftChoice,
  events: FarmWarsEvent[],
) {
  if (choice === 1) {
    // Reset worms
    for (let i = 0; i < enemy.actors.length; i++) {
      const a = enemy.actors[i];
      if (a.type === 'worm' && a.respawnIn === 0) {
        a.x = enemy.bases[a.baseIndex].x;
        a.y = enemy.bases[a.baseIndex].y;
        events.push({
          type: 'worm_reset',
          team: enemy.id,
          actorIndex: i,
          toPos: { x: a.x, y: a.y },
        });
      }
    }
  } else if (choice === 2) {
    // Deposit harvesters
    for (let i = 0; i < team.actors.length; i++) {
      const a = team.actors[i];
      if (a.type === 'harvester' && a.inventory > 0 && a.respawnIn === 0) {
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
  } else if (choice === 3) {
    // Score points
    team.score += 5;
    events.push({
      type: 'score',
      team: team.id,
      delta: 5,
      reason: 'gift_reward',
    });
  }
}
