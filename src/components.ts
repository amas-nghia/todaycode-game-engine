import { EntityId } from './entity';

export interface PositionComponent {
  x: number;
  y: number;
}

export interface MovementComponent {
  speed: number;
  stepDistance: number;
}

export interface MotionComponent {
  from: { x: number; y: number };
  target: { x: number; y: number };
  remainingDistance: number;
}

export interface CollisionComponent {
  radius: number;
}

export interface BlockingComponent {
  blocksMovement: boolean;
}

export interface HealthComponent {
  current: number;
  max: number;
}

export interface CombatComponent {
  damage: number;
  range: number;
  cooldownFrames?: number;
}

export interface CollectibleComponent {
  kind: string;
  collectedBy?: string;
}

export interface InventoryComponent {
  counts: Record<string, number>;
}

export interface TeamComponent {
  id: string | number;
}

export interface CooldownComponent {
  actions: Record<string, number>;
}

export interface ProgrammableComponent {
  agentId: number | string;
  visibleTeam?: string | number;
  apiProfile?: string;
}

export interface ObjectiveTargetComponent {
  targetId?: EntityId;
  targetPosition?: { x: number; y: number };
}
