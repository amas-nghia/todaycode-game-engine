import { Position, TeamID, GiftBox, GiftChoice, ActorType } from './state';

export type FarmWarsEvent =
  | { type: 'tree_plant'; team: TeamID; pos: Position; treeId: number }
  | {
      type: 'harvest';
      team: TeamID;
      actorIndex: number;
      treePos: Position;
      fruitsPicked: number;
    }
  | {
      type: 'tree_destroy';
      wormTeam: TeamID;
      treePos: Position;
      treeId: number;
      treeTeam: TeamID;
    }
  | {
      type: 'harvester_reset';
      team: TeamID;
      actorIndex: number;
      toPos: Position;
      inventoryLost: number;
    }
  | { type: 'worm_reset'; team: TeamID; actorIndex: number; toPos: Position }
  | {
      type: 'collision_worm_harv';
      wormTeam: TeamID;
      harvesterTeam: TeamID;
      fruitsStolen: number;
      harvesterPos: Position;
    }
  | {
      type: 'planter_vs_worm';
      planterTeam: TeamID;
      wormTeam: TeamID;
      wormPos: Position;
    }
  | { type: 'fruit_grow'; treeId: number; pos: Position; newFruits: number }
  | {
      type: 'score';
      team: TeamID;
      delta: number;
      reason: 'worm_steal' | 'harvest_deposit' | 'gift_reward';
    }
  | { type: 'gift_expire'; ids: number[] }
  | { type: 'gift_spawn'; gifts: GiftBox[] }
  | { type: 'gift_pickup'; team: TeamID; choice: GiftChoice; pos: Position }
  // v2 new events
  | {
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
    }
  | {
      type: 'unit_death';
      team: TeamID;
      actorIndex: number;
      pos: Position;
      actorType: ActorType;
    }
  | {
      type: 'unit_respawn';
      team: TeamID;
      actorIndex: number;
      pos: Position;
      actorType: ActorType;
    }
  | {
      type: 'fruit_drop';
      team: TeamID;
      actorIndex: number;
      pos: Position;
      amount: number;
    }
  | { type: 'debuff_applied'; team: TeamID; actorIndex: number; debuff: string }
  | { type: 'debuff_expired'; team: TeamID; actorIndex: number; debuff: string }
  | { type: 'move'; team: TeamID; actorIndex: number; toPos: Position };
