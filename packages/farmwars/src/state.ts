export type TeamID = 1 | 2;
export type ActorType = 'planter' | 'harvester' | 'worm';

// Gift pickup preference: 0=none, 1=reset enemy worms, 2=deposit harvesters, 3=+GiftRewardPoints
export type GiftChoice = 0 | 1 | 2 | 3;

export interface Position {
  x: number;
  y: number;
}

export interface GiftBox {
  id: number;
  x: number;
  y: number;
  spawnedTurn: number; // in ticks
}

export interface ActorStats {
  hp: number;
  maxHp: number;
  atk: number;
  speed: number;
  carry: number;
}

export interface Actor {
  type: ActorType;
  x: number;
  y: number;
  cooldown: number; // in ticks
  baseIndex: number;
  inventory: number;

  // v2 additions
  stats: ActorStats;
  slowDebuffTicks: number; // ticks remaining for venomous bite slow
  respawnIn: number; // ticks remaining until respawn (0 = alive)
  droppedFruits: number; // Fruits dropped when harvester dies
}

export interface Tree {
  id: number;
  x: number;
  y: number;
  team: TeamID;
  age: number; // in ticks
  fruits: number;
}

export interface TeamState {
  id: TeamID;
  bases: Position[];
  score: number;
  actors: Actor[];
}

export interface FarmWarsState {
  turn: number; // tick index
  team1: TeamState;
  team2: TeamState;
  trees: Tree[];
  gifts: GiftBox[];
  seed: number; // represented as number for bitwise operations but logic will ensure safety
  nextTreeId: number;
  nextGiftId: number;
}
