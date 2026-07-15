import { EntityId } from './entity';

export interface BaseEvent {
  type: string;
  frame: number;
}

export interface MoveEvent extends BaseEvent {
  type: 'move';
  actorId: EntityId;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export interface MoveBlockedEvent extends BaseEvent {
  type: 'move_blocked';
  actorId: EntityId;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export interface AttackEvent extends BaseEvent {
  type: 'attack';
  actorId: EntityId;
  targetId: EntityId;
}

export interface DamageEvent extends BaseEvent {
  type: 'damage';
  actorId: EntityId;
  targetId: EntityId;
  damage: number;
  currentBefore: number;
  currentAfter: number;
}

export interface DeathEvent extends BaseEvent {
  type: 'death';
  actorId: EntityId;
  targetId: EntityId;
}

export interface PickupEvent extends BaseEvent {
  type: 'pickup';
  actorId: EntityId;
  targetId: EntityId; // item id
}

export interface ScoreEvent extends BaseEvent {
  type: 'score';
  teamId?: string | number;
  score: number;
  reason?: string;
}

export interface ObjectiveCompletedEvent extends BaseEvent {
  type: 'objective_completed';
  objectiveId: string;
}

export interface LogEvent extends BaseEvent {
  type: 'log';
  message: string;
}

export interface CustomEvent extends BaseEvent {
  type: 'custom';
  subtype: string;
  payload: unknown;
}

export type GameEvent =
  | MoveEvent
  | MoveBlockedEvent
  | AttackEvent
  | DamageEvent
  | DeathEvent
  | PickupEvent
  | ScoreEvent
  | ObjectiveCompletedEvent
  | LogEvent
  | CustomEvent;
