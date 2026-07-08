// packages/farmwars/src/constants.ts
var GridWidth = 12;
var GridHeight = 9;
var MaxTicks = 200;
var FRAMES_PER_TICK = 3;
var MaxFrames = MaxTicks * FRAMES_PER_TICK;
var TreeBearFruitAge = 6;
var GiftInterval = 10;
var GiftRewardPoints = 5;
var MidCol = 5;
var RightEdge = 11;
var ValidDirections = {
  up: true,
  down: true,
  left: true,
  right: true,
  stay: true
};
var DirectionDeltas = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  stay: { x: 0, y: 0 }
};
var ACTOR_STATS = {
  planter: { hp: 6, maxHp: 6, atk: 1, speed: 1, carry: 0 },
  harvester: { hp: 3, maxHp: 3, atk: 0, speed: 3, carry: 3 },
  worm: { hp: 4, maxHp: 4, atk: 3, speed: 2, carry: 0 }
};
var SPEED_SCHEDULES = {
  1: [0],
  2: [0, 2],
  3: [0, 1, 2]
};

// packages/farmwars/src/orders.ts
function parseActions(rawLines, actorCount) {
  const directions = Array(actorCount).fill("stay");
  for (let i = 0; i < actorCount; i++) {
    if (i < rawLines.length) {
      const d = rawLines[i].trim();
      if (ValidDirections[d]) {
        directions[i] = d;
      }
    }
  }
  let giftChoice = 0;
  if (actorCount < rawLines.length) {
    const parts = rawLines[actorCount].trim().split(/\s+/);
    if (parts.length === 2 && parts[0] === "gift") {
      const v = parseInt(parts[1], 10);
      if (!isNaN(v) && v >= 0 && v <= 3) {
        giftChoice = v;
      }
    }
  }
  let baseSetup;
  if (actorCount + 1 < rawLines.length) {
    const parts = rawLines[actorCount + 1].trim().split(/\s+/);
    if (parts.length === 4 && parts[0] === "base") {
      const v1 = parseInt(parts[1], 10);
      const v2 = parseInt(parts[2], 10);
      const v3 = parseInt(parts[3], 10);
      if (!isNaN(v1) && !isNaN(v2) && !isNaN(v3)) {
        baseSetup = [v1, v2, v3];
      }
    }
  }
  return { directions, giftChoice, baseSetup };
}

// packages/farmwars/src/initial-state.ts
var team1Bases = [
  { x: 0, y: 1 },
  { x: 0, y: 4 },
  { x: 0, y: 7 }
];
var team2Bases = [
  { x: 11, y: 1 },
  { x: 11, y: 4 },
  { x: 11, y: 7 }
];
function makeTeam(id, bases) {
  const types = ["planter", "harvester", "worm"];
  const actors = types.map((t, i) => {
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
      droppedFruits: 0
    };
  });
  return {
    id,
    bases: [...bases],
    score: 0,
    actors
  };
}
function createInitialState(seed) {
  return {
    turn: 0,
    team1: makeTeam(1, team1Bases),
    team2: makeTeam(2, team2Bases),
    trees: [],
    gifts: [],
    seed,
    nextTreeId: 1,
    nextGiftId: 1
  };
}
function applyBaseSetup(team2, setup) {
  const maxIdx = team2.bases.length - 1;
  const actors = team2.actors.map((actor, i) => {
    if (i >= 3) return actor;
    let idx = setup[i];
    if (idx < 0) idx = 0;
    else if (idx > maxIdx) idx = maxIdx;
    const b = team2.bases[idx];
    return {
      ...actor,
      baseIndex: idx,
      x: b.x,
      y: b.y
    };
  });
  return { ...team2, actors };
}

// packages/farmwars/src/gift-rng.ts
var goldenGamma = 2654435761;
function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a = a + 1831565813 >>> 0;
    let t = (a ^ a >>> 15) >>> 0;
    t = Math.imul(t, (1 | a) >>> 0) >>> 0;
    t = t + Math.imul(t ^ t >>> 7, (61 | t) >>> 0) >>> 0;
    t = (t ^ t >>> 14) >>> 0;
    return t / 4294967296;
  };
}
function giftPositionsForTurn(seed, turn, team1Bases2) {
  const turnRngMix = Math.imul(turn, goldenGamma);
  const rngSeed = (seed ^ turnRngMix) >>> 0;
  const rng = mulberry32(rngSeed);
  const widthLeft = MidCol + 1;
  let x = 0;
  let y = 0;
  while (true) {
    x = Math.trunc(rng() * widthLeft);
    y = Math.trunc(rng() * GridHeight);
    const isBase = team1Bases2.some((b) => b.x === x && b.y === y);
    if (!isBase) {
      break;
    }
  }
  return [
    { x, y },
    { x: RightEdge - x, y }
  ];
}

// packages/farmwars/src/combat.ts
function resolveCombat(state, events) {
  const actors1 = state.team1.actors;
  const actors2 = state.team2.actors;
  for (let i = 0; i < actors1.length; i++) {
    const a1 = actors1[i];
    if (a1.respawnIn > 0) continue;
    for (let j = 0; j < actors2.length; j++) {
      const a2 = actors2[j];
      if (a2.respawnIn > 0) continue;
      if (a1.x === a2.x && a1.y === a2.y) {
        const dmg1 = a2.stats.atk;
        const dmg2 = a1.stats.atk;
        a1.stats.hp -= dmg1;
        a2.stats.hp -= dmg2;
        events.push({
          type: "combat",
          team1: 1,
          actor1: i,
          team2: 2,
          actor2: j,
          pos: { x: a1.x, y: a1.y },
          dmg1,
          dmg2,
          newHp1: a1.stats.hp,
          newHp2: a2.stats.hp
        });
      }
    }
  }
  handleDeaths(1, actors1, events);
  handleDeaths(2, actors2, events);
}
function handleDeaths(team2, actors, events) {
  for (let i = 0; i < actors.length; i++) {
    const a = actors[i];
    if (a.respawnIn === 0 && a.stats.hp <= 0) {
      a.stats.hp = 0;
      a.respawnIn = Math.trunc((a.stats.maxHp + 1) / 2);
      events.push({
        type: "unit_death",
        team: team2,
        actorIndex: i,
        pos: { x: a.x, y: a.y },
        actorType: a.type
      });
      if (a.type === "harvester" && a.inventory > 0) {
        a.droppedFruits = a.inventory;
        a.inventory = 0;
        events.push({
          type: "fruit_drop",
          team: team2,
          actorIndex: i,
          pos: { x: a.x, y: a.y },
          amount: a.droppedFruits
        });
      }
    }
  }
}

// packages/farmwars/src/scoring.ts
function handleDeposits(state, events) {
  processTeamDeposits(state.team1, events);
  processTeamDeposits(state.team2, events);
}
function processTeamDeposits(team2, events) {
  for (let i = 0; i < team2.actors.length; i++) {
    const a = team2.actors[i];
    if (a.respawnIn > 0) continue;
    if (a.type === "harvester" && a.inventory > 0) {
      const onBase = team2.bases.some((b) => b.x === a.x && b.y === a.y);
      if (onBase) {
        team2.score += a.inventory;
        events.push({
          type: "score",
          team: team2.id,
          delta: a.inventory,
          reason: "harvest_deposit"
        });
        a.inventory = 0;
      }
    }
  }
}

// packages/farmwars/src/tick.ts
function inGrid(x, y) {
  return x >= 0 && x < GridWidth && y >= 0 && y < GridHeight;
}
function onAnyBase(x, y, state) {
  for (const b of state.team1.bases) if (b.x === x && b.y === y) return true;
  for (const b of state.team2.bases) if (b.x === x && b.y === y) return true;
  return false;
}
function treeIndexAt(trees, x, y) {
  return trees.findIndex((t) => t.x === x && t.y === y);
}
function applyTick(state, frame, actions1, actions2) {
  const events = [];
  const offset = frame % FRAMES_PER_TICK;
  const isEndOfTick = offset === FRAMES_PER_TICK - 1;
  if (frame === 0) {
    if (actions1.baseSetup) applyBaseSetup2(state.team1, actions1.baseSetup);
    if (actions2.baseSetup) applyBaseSetup2(state.team2, actions2.baseSetup);
  }
  processMovementAndAutoActions(state, 1, actions1, offset, events);
  processMovementAndAutoActions(state, 2, actions2, offset, events);
  resolveCombat2(state, events);
  if (isEndOfTick) {
    processEndOfTickRespawnsAndDebuffs(state, 1, events);
    processEndOfTickRespawnsAndDebuffs(state, 2, events);
    ageTrees(state, events);
    handleDeposits(state, events);
    decrementCooldowns(state.team1);
    decrementCooldowns(state.team2);
    state.turn++;
    expireGifts(state, events);
    spawnGifts(state, events);
    resolveGiftPickups(state, actions1.giftChoice, actions2.giftChoice, events);
  }
  return { state, events };
}
function applyBaseSetup2(team2, setup) {
  const maxIdx = team2.bases.length - 1;
  for (let i = 0; i < 3 && i < team2.actors.length; i++) {
    let idx = setup[i];
    if (idx < 0) idx = 0;
    else if (idx > maxIdx) idx = maxIdx;
    team2.actors[i].baseIndex = idx;
    team2.actors[i].x = team2.bases[idx].x;
    team2.actors[i].y = team2.bases[idx].y;
  }
}
function processMovementAndAutoActions(state, teamId, actions, offset, events) {
  const team2 = teamId === 1 ? state.team1 : state.team2;
  for (let i = 0; i < team2.actors.length; i++) {
    const actor = team2.actors[i];
    if (actor.respawnIn > 0) continue;
    const actualSpeed = Math.max(
      1,
      actor.stats.speed - (actor.slowDebuffTicks > 0 ? 1 : 0)
    );
    const schedule = SPEED_SCHEDULES[actualSpeed] || SPEED_SCHEDULES[1];
    if (!schedule.includes(offset)) continue;
    const dir = actions.directions[i] || "stay";
    if (dir !== "stay" && actor.cooldown === 0) {
      const delta = DirectionDeltas[dir];
      const targetX = actor.x + delta.x;
      const targetY = actor.y + delta.y;
      let valid = inGrid(targetX, targetY);
      if (valid && (actor.type === "planter" || actor.type === "worm") && onAnyBase(targetX, targetY, state)) {
        valid = false;
      }
      if (valid) {
        actor.x = targetX;
        actor.y = targetY;
        events.push({
          type: "move",
          team: teamId,
          actorIndex: i,
          toPos: { x: targetX, y: targetY }
        });
      }
    }
    if (actor.type === "planter" && !onAnyBase(actor.x, actor.y, state)) {
      if (treeIndexAt(state.trees, actor.x, actor.y) === -1) {
        const treeId = state.nextTreeId++;
        state.trees.push({
          id: treeId,
          x: actor.x,
          y: actor.y,
          team: teamId,
          age: 0,
          fruits: 0
        });
        events.push({
          type: "tree_plant",
          team: teamId,
          pos: { x: actor.x, y: actor.y },
          treeId
        });
      }
    } else if (actor.type === "harvester") {
      const idx = treeIndexAt(state.trees, actor.x, actor.y);
      if (idx !== -1 && state.trees[idx].team === teamId && state.trees[idx].fruits > 0) {
        const picked = state.trees[idx].fruits;
        state.trees[idx].fruits = 0;
        actor.inventory += picked;
        events.push({
          type: "harvest",
          team: teamId,
          actorIndex: i,
          treePos: { x: actor.x, y: actor.y },
          fruitsPicked: picked
        });
      }
    } else if (actor.type === "worm") {
      const idx = treeIndexAt(state.trees, actor.x, actor.y);
      if (idx !== -1 && state.trees[idx].team !== teamId) {
        events.push({
          type: "tree_destroy",
          wormTeam: teamId,
          treePos: { x: actor.x, y: actor.y },
          treeId: state.trees[idx].id,
          treeTeam: state.trees[idx].team
        });
        state.trees.splice(idx, 1);
      }
    }
  }
}
function resolveCombat2(state, events) {
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
        if (a1.type === "planter") {
          const t1 = treeIndexAt(state.trees, a1.x, a1.y);
          if (t1 !== -1 && state.trees[t1].team === 1)
            dmg1 = Math.max(0, dmg1 - 2);
        }
        if (a2.type === "planter") {
          const t2 = treeIndexAt(state.trees, a2.x, a2.y);
          if (t2 !== -1 && state.trees[t2].team === 2)
            dmg2 = Math.max(0, dmg2 - 2);
        }
        a1.stats.hp -= dmg1;
        a2.stats.hp -= dmg2;
        events.push({
          type: "combat",
          team1: 1,
          actor1: i,
          team2: 2,
          actor2: j,
          pos: { x: a1.x, y: a1.y },
          dmg1,
          dmg2,
          newHp1: a1.stats.hp,
          newHp2: a2.stats.hp
        });
        if (a1.type === "worm" && dmg2 > 0) {
          a2.slowDebuffTicks = 3;
          events.push({
            type: "debuff_applied",
            team: 2,
            actorIndex: j,
            debuff: "slow"
          });
        }
        if (a2.type === "worm" && dmg1 > 0) {
          a1.slowDebuffTicks = 3;
          events.push({
            type: "debuff_applied",
            team: 1,
            actorIndex: i,
            debuff: "slow"
          });
        }
      }
    }
  }
  handleDeaths2(1, state.team1, events);
  handleDeaths2(2, state.team2, events);
}
function handleDeaths2(teamId, team2, events) {
  for (let i = 0; i < team2.actors.length; i++) {
    const a = team2.actors[i];
    if (a.respawnIn === 0 && a.stats.hp <= 0) {
      a.stats.hp = 0;
      a.respawnIn = Math.trunc((a.stats.maxHp + 1) / 2);
      a.slowDebuffTicks = 0;
      events.push({
        type: "unit_death",
        team: teamId,
        actorIndex: i,
        pos: { x: a.x, y: a.y },
        actorType: a.type
      });
      if (a.type === "harvester" && a.inventory > 0) {
        a.droppedFruits = a.inventory;
        a.inventory = 0;
        events.push({
          type: "fruit_drop",
          team: teamId,
          actorIndex: i,
          pos: { x: a.x, y: a.y },
          amount: a.droppedFruits
        });
      }
    }
  }
}
function processEndOfTickRespawnsAndDebuffs(state, teamId, events) {
  const team2 = teamId === 1 ? state.team1 : state.team2;
  for (let i = 0; i < team2.actors.length; i++) {
    const a = team2.actors[i];
    if (a.slowDebuffTicks > 0) {
      a.slowDebuffTicks--;
      if (a.slowDebuffTicks === 0) {
        events.push({
          type: "debuff_expired",
          team: teamId,
          actorIndex: i,
          debuff: "slow"
        });
      }
    }
    if (a.respawnIn > 0) {
      a.respawnIn--;
      if (a.respawnIn === 0) {
        const base = team2.bases[a.baseIndex];
        a.x = base.x;
        a.y = base.y;
        a.stats.hp = a.stats.maxHp;
        events.push({
          type: "unit_respawn",
          team: teamId,
          actorIndex: i,
          pos: { x: a.x, y: a.y },
          actorType: a.type
        });
      }
    }
  }
}
function ageTrees(state, events) {
  for (const t of state.trees) {
    t.age++;
    const natural = t.age >= TreeBearFruitAge ? 1 : 0;
    const newFruits = Math.max(natural, t.fruits);
    if (newFruits !== t.fruits) {
      events.push({
        type: "fruit_grow",
        treeId: t.id,
        pos: { x: t.x, y: t.y },
        newFruits
      });
    }
    t.fruits = newFruits;
  }
}
function decrementCooldowns(team2) {
  for (const a of team2.actors) {
    a.cooldown = Math.max(0, a.cooldown - 1);
  }
}
function expireGifts(state, events) {
  const expired = [];
  state.gifts = state.gifts.filter((g) => {
    if (state.turn - g.spawnedTurn >= GiftInterval) {
      expired.push(g.id);
      return false;
    }
    return true;
  });
  if (expired.length > 0) {
    events.push({ type: "gift_expire", ids: expired });
  }
}
function spawnGifts(state, events) {
  if (state.turn % GiftInterval !== 0) return;
  const [pA, pB] = giftPositionsForTurn(
    state.seed,
    state.turn,
    state.team1.bases
  );
  const boxA = {
    id: state.nextGiftId,
    x: pA.x,
    y: pA.y,
    spawnedTurn: state.turn
  };
  const boxB = {
    id: state.nextGiftId + 1,
    x: pB.x,
    y: pB.y,
    spawnedTurn: state.turn
  };
  state.gifts.push(boxA, boxB);
  state.nextGiftId += 2;
  events.push({ type: "gift_spawn", gifts: [boxA, boxB] });
}
function resolveGiftPickups(state, c1, c2, events) {
  const consumed = /* @__PURE__ */ new Set();
  const pickup = (teamId, team2, enemy, choice) => {
    for (const a of team2.actors) {
      for (const g of state.gifts) {
        if (consumed.has(g.id) || g.x !== a.x || g.y !== a.y) continue;
        events.push({
          type: "gift_pickup",
          team: teamId,
          choice,
          pos: { x: g.x, y: g.y }
        });
        consumed.add(g.id);
        if (choice !== 0) {
          applyGiftEffect(team2, enemy, choice, events);
        }
        break;
      }
    }
  };
  pickup(1, state.team1, state.team2, c1);
  pickup(2, state.team2, state.team1, c2);
  state.gifts = state.gifts.filter((g) => !consumed.has(g.id));
}
function applyGiftEffect(team2, enemy, choice, events) {
  if (choice === 1) {
    for (let i = 0; i < enemy.actors.length; i++) {
      const a = enemy.actors[i];
      if (a.type === "worm" && a.respawnIn === 0) {
        a.x = enemy.bases[a.baseIndex].x;
        a.y = enemy.bases[a.baseIndex].y;
        events.push({
          type: "worm_reset",
          team: enemy.id,
          actorIndex: i,
          toPos: { x: a.x, y: a.y }
        });
      }
    }
  } else if (choice === 2) {
    for (let i = 0; i < team2.actors.length; i++) {
      const a = team2.actors[i];
      if (a.type === "harvester" && a.inventory > 0 && a.respawnIn === 0) {
        team2.score += a.inventory;
        events.push({
          type: "score",
          team: team2.id,
          delta: a.inventory,
          reason: "harvest_deposit"
        });
        a.inventory = 0;
      }
    }
  } else if (choice === 3) {
    team2.score += 5;
    events.push({
      type: "score",
      team: team2.id,
      delta: 5,
      reason: "gift_reward"
    });
  }
}

// packages/farmwars/src/wire.ts
function toWireTeam(team2, hideInventory) {
  const actors = team2.actors.map((a) => {
    const wa = {
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
        carry: a.stats.carry
      },
      debuffs: a.slowDebuffTicks > 0 ? ["venomous_bite"] : [],
      respawnIn: a.respawnIn
    };
    if (a.type === "harvester" && !hideInventory) {
      wa.inventory = a.inventory;
    }
    return wa;
  });
  const bases = team2.bases.map((b) => ({ x: b.x, y: b.y }));
  return { id: team2.id, bases, score: team2.score, actors };
}
function serializeForSide(state, perspective) {
  const myTeam = perspective === 1 ? state.team1 : state.team2;
  const enemyTeam = perspective === 1 ? state.team2 : state.team1;
  const trees = state.trees.map((t) => ({
    x: t.x,
    y: t.y,
    team: t.team,
    age: t.age,
    fruits: t.fruits
  }));
  const gifts = state.gifts.map((g) => ({ x: g.x, y: g.y }));
  const wire = {
    turn: state.turn,
    max_turns: MaxTicks,
    my_side: perspective,
    my_team: toWireTeam(myTeam, false),
    enemy_team: toWireTeam(enemyTeam, true),
    grid: { width: GridWidth, height: GridHeight, trees },
    gifts
  };
  return JSON.stringify(wire);
}
function wireState(state, events) {
  return {
    state,
    events
  };
}

// packages/farmwars/src/farmwars.engine.ts
var FarmWarsEngine = class {
  name() {
    return "farm-wars";
  }
  version() {
    return "2.0.0";
  }
  init(level, seed) {
    return createInitialState(seed);
  }
  applyOrders(state, agentId, orders) {
    const actions = parseActions(orders, 3);
    if (!state.hasOwnProperty("__actions")) {
      state.__actions = {};
    }
    state.__actions[agentId] = actions;
    return state;
  }
  tick(state, frame) {
    const actionsMap = state.__actions || {};
    const actions1 = actionsMap[1] || parseActions([], 3);
    const actions2 = actionsMap[2] || parseActions([], 3);
    const isEndOfTick = frame % 3 === 2;
    if (isEndOfTick) {
      state.__actions = {};
    }
    return applyTick(state, frame, actions1, actions2);
  }
  isOver(state) {
    if (state.turn >= MaxFrames / 3) return true;
    const isTeam1Dead = state.team1.actors.every((a) => a.respawnIn > 0);
    const isTeam2Dead = state.team2.actors.every((a) => a.respawnIn > 0);
    return isTeam1Dead || isTeam2Dead;
  }
  result(state) {
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
        2: state.team2.score
      }
    };
  }
  formatState(state, events) {
    return JSON.stringify(wireState(state, events));
  }
};

// packages/farmwars/src/replay.ts
function team(state, id) {
  return id === 1 ? state.team1 : state.team2;
}
function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}
function findActor(state, id, actorIndex) {
  return team(state, id).actors[actorIndex];
}
function findActorByPos(state, id, x, y) {
  return team(state, id).actors.find((a) => a.x === x && a.y === y);
}
function findTreeById(state, treeId) {
  return state.trees.find((t) => t.id === treeId);
}
function applyFrame(state, events) {
  return events.reduce(applyEvent, state);
}
function applyEvent(prev, event) {
  const state = cloneState(prev);
  switch (event.type) {
    case "move": {
      const actor = findActor(state, event.team, event.actorIndex);
      actor.x = event.toPos.x;
      actor.y = event.toPos.y;
      return state;
    }
    case "tree_plant": {
      state.trees.push({
        id: event.treeId,
        x: event.pos.x,
        y: event.pos.y,
        team: event.team,
        age: 0,
        fruits: 0
      });
      return state;
    }
    case "harvest": {
      const tree = findTreeByPos(state, event.treePos);
      if (tree) tree.fruits = 0;
      const actor = findActor(state, event.team, event.actorIndex);
      actor.inventory += event.fruitsPicked;
      return state;
    }
    case "tree_destroy": {
      state.trees = state.trees.filter((t) => t.id !== event.treeId);
      return state;
    }
    case "harvester_reset": {
      const actor = findActor(state, event.team, event.actorIndex);
      actor.x = event.toPos.x;
      actor.y = event.toPos.y;
      actor.inventory = 0;
      return state;
    }
    case "worm_reset": {
      const actor = findActor(state, event.team, event.actorIndex);
      actor.x = event.toPos.x;
      actor.y = event.toPos.y;
      return state;
    }
    case "collision_worm_harv": {
      const harvester = findActorByPos(state, event.harvesterTeam, event.harvesterPos.x, event.harvesterPos.y);
      if (harvester) harvester.inventory = Math.max(0, harvester.inventory - event.fruitsStolen);
      return state;
    }
    case "planter_vs_worm": {
      return state;
    }
    case "fruit_grow": {
      const tree = findTreeById(state, event.treeId);
      if (tree) tree.fruits = event.newFruits;
      return state;
    }
    case "score": {
      team(state, event.team).score += event.delta;
      return state;
    }
    case "gift_expire": {
      const ids = new Set(event.ids);
      state.gifts = state.gifts.filter((g) => !ids.has(g.id));
      return state;
    }
    case "gift_spawn": {
      state.gifts.push(...event.gifts);
      return state;
    }
    case "gift_pickup": {
      const idx = state.gifts.findIndex((g) => g.x === event.pos.x && g.y === event.pos.y);
      if (idx !== -1) state.gifts.splice(idx, 1);
      return state;
    }
    case "combat": {
      findActor(state, event.team1, event.actor1).stats.hp = event.newHp1;
      findActor(state, event.team2, event.actor2).stats.hp = event.newHp2;
      return state;
    }
    case "unit_death": {
      const actor = findActor(state, event.team, event.actorIndex);
      actor.stats.hp = 0;
      actor.respawnIn = Math.trunc((actor.stats.maxHp + 1) / 2);
      return state;
    }
    case "unit_respawn": {
      const actor = findActor(state, event.team, event.actorIndex);
      actor.x = event.pos.x;
      actor.y = event.pos.y;
      actor.stats.hp = actor.stats.maxHp;
      return state;
    }
    case "fruit_drop": {
      const actor = findActor(state, event.team, event.actorIndex);
      actor.droppedFruits = event.amount;
      actor.inventory = 0;
      return state;
    }
    case "debuff_applied": {
      const actor = findActor(state, event.team, event.actorIndex);
      actor.slowDebuffTicks = 3;
      return state;
    }
    case "debuff_expired": {
      const actor = findActor(state, event.team, event.actorIndex);
      actor.slowDebuffTicks = 0;
      return state;
    }
    default: {
      const _exhaustive = event;
      return state;
    }
  }
}
function findTreeByPos(state, pos) {
  return state.trees.find((t) => t.x === pos.x && t.y === pos.y);
}
export {
  ACTOR_STATS,
  DirectionDeltas,
  FRAMES_PER_TICK,
  FarmWarsEngine,
  GiftInterval,
  GiftRewardPoints,
  GridHeight,
  GridWidth,
  MaxFrames,
  MaxTicks,
  MidCol,
  RightEdge,
  SPEED_SCHEDULES,
  TreeBearFruitAge,
  ValidDirections,
  applyBaseSetup,
  applyEvent,
  applyFrame,
  applyTick,
  createInitialState,
  giftPositionsForTurn,
  goldenGamma,
  handleDeposits,
  mulberry32,
  parseActions,
  resolveCombat,
  serializeForSide,
  team1Bases,
  team2Bases,
  wireState
};
//# sourceMappingURL=farmwars.js.map