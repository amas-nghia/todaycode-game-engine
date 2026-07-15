import { EntityId } from './entity';
import { WorldState } from './world';
import { GameEvent } from './events';

export interface Action<Payload = unknown> {
  type: string;
  actorId: EntityId;
  payload?: Payload;
  source?: 'runner' | 'system' | 'auto';
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export interface ActionResult {
  events: GameEvent[];
}

export interface ActionContext {
  world: WorldState;
  frame: number;
}

export interface ActionHandler<Payload = unknown> {
  type: string;
  validate(ctx: ActionContext, action: Action<Payload>): ValidationResult;
  apply(ctx: ActionContext, action: Action<Payload>): ActionResult;
}

// Standard action constants
export const ACTION_MOVE = 'MOVE';
export const ACTION_ATTACK = 'ATTACK';
export const ACTION_PICK_UP = 'PICK_UP';
export const ACTION_CAST = 'CAST';
export const ACTION_SAY = 'SAY';
export const ACTION_WAIT = 'WAIT';
