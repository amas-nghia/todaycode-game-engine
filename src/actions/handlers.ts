import { Action, ActionContext, ValidationResult } from '../actions';
import { MultiFrameActionHandler, MultiFrameActionState, MultiFrameActionStepResult } from '../multi-frame-action';
import { getComponent, setComponent, hasComponent } from '../entity';
import { PositionComponent, MovementComponent, MotionComponent, CombatComponent, HealthComponent, CollectibleComponent, InventoryComponent } from '../components';
import { isPositionInBounds, isSegmentClear, distance } from '../physics';
import { GameEvent } from '../events';

export type MoveDirectionPayload = {
  direction: 'up' | 'down' | 'left' | 'right';
  distance?: number;
};

type MoveDirectionLocalState = {
  blocked?: boolean;
  target: { x: number; y: number };
  blockedTo?: { x: number; y: number };
  reason?: string;
};

function movePoint(
  position: { x: number; y: number },
  direction: MoveDirectionPayload['direction'],
  distanceToMove: number
) {
  const target = { x: position.x, y: position.y };

  if (direction === 'up') target.y += distanceToMove;
  else if (direction === 'down') target.y -= distanceToMove;
  else if (direction === 'left') target.x -= distanceToMove;
  else if (direction === 'right') target.x += distanceToMove;

  return target;
}

export class MoveDirectionHandler implements MultiFrameActionHandler<MoveDirectionPayload, MoveDirectionLocalState> {
  type = 'MOVE_DIRECTION';

  validate(ctx: ActionContext, action: Action<MoveDirectionPayload>): ValidationResult {
    const actor = ctx.world.entities[action.actorId];
    if (!actor) return { valid: false, reason: 'Actor not found' };
    if (!action.payload) return { valid: false, reason: 'Missing move payload' };
    
    const pos = getComponent<PositionComponent>(actor, 'position');
    if (!pos) return { valid: false, reason: 'Actor has no position' };

    const mov = getComponent<MovementComponent>(actor, 'movement');
    if (!mov) return { valid: false, reason: 'Actor has no movement component' };

    if (action.payload?.distance !== undefined && action.payload.distance <= 0) {
      return { valid: false, reason: 'Distance must be > 0' };
    }

    return { valid: true };
  }

  start(ctx: ActionContext, action: Action<MoveDirectionPayload>) {
    const actor = ctx.world.entities[action.actorId];
    const pos = getComponent<PositionComponent>(actor, 'position')!;
    const mov = getComponent<MovementComponent>(actor, 'movement')!;
    
    const dir = action.payload!.direction;
    let remainingDistance = action.payload!.distance ?? mov.stepDistance;
    const actorRadius = actor.components.collision ? (actor.components.collision as any).radius : 0;

    let target = { x: pos.x, y: pos.y };
    let blockedTo: { x: number; y: number } | undefined;
    let blockedReason: string | undefined;

    while (remainingDistance > 0) {
      const segmentDistance = Math.min(mov.stepDistance, remainingDistance);
      const nextTarget = movePoint(target, dir, segmentDistance);

      if (!isPositionInBounds(ctx.world, nextTarget)) {
        blockedTo = nextTarget;
        blockedReason = 'Target out of bounds';
        break;
      }

      if (!isSegmentClear(ctx.world, target, nextTarget, action.actorId, actorRadius)) {
        blockedTo = nextTarget;
        blockedReason = 'Path blocked';
        break;
      }

      target = nextTarget;
      remainingDistance -= segmentDistance;
    }

    if (target.x === pos.x && target.y === pos.y && blockedTo) {
      return { localState: { blocked: true, target: blockedTo, blockedTo, reason: blockedReason } };
    }

    setComponent(actor, 'motion', {
      from: { x: pos.x, y: pos.y },
      target,
      remainingDistance: distance(pos, target)
    } as MotionComponent);

    return {
      localState: blockedTo
        ? { blocked: true, target, blockedTo, reason: blockedReason }
        : { target }
    };
  }

  step(
    ctx: ActionContext,
    state: MultiFrameActionState<MoveDirectionPayload, MoveDirectionLocalState>
  ): MultiFrameActionStepResult<MoveDirectionLocalState> {
    const actor = ctx.world.entities[state.action.actorId];

    if (state.localState?.blocked && (!actor || !hasComponent(actor, 'motion'))) {
      const pos = actor ? getComponent<PositionComponent>(actor, 'position') : undefined;

      return {
        status: 'done',
        events: [{
          type: 'move_blocked',
          frame: ctx.frame,
          actorId: state.action.actorId,
          from: pos ? { x: pos.x, y: pos.y } : { x: 0, y: 0 },
          to: state.localState.blockedTo ?? state.localState.target,
        }],
      };
    }

    // If motion component was removed (by MovementSystem), we're done
    if (!actor || !hasComponent(actor, 'motion')) {
      return { status: 'done', events: [] };
    }

    return { status: 'running', events: [], localState: state.localState };
  }
}

export class WaitHandler implements MultiFrameActionHandler<{ frames: number }, { remaining: number }> {
  type = 'WAIT';

  validate(ctx: ActionContext, action: Action<{ frames: number }>): ValidationResult {
    return { valid: action.payload!.frames > 0, reason: 'Frames must be > 0' };
  }

  start(ctx: ActionContext, action: Action<{ frames: number }>) {
    return { localState: { remaining: action.payload!.frames } };
  }

  step(ctx: ActionContext, state: any): MultiFrameActionStepResult<{ remaining: number }> {
    const remaining = state.localState.remaining - 1;
    if (remaining <= 0) {
      return { status: 'done', events: [] };
    }
    return { status: 'running', events: [], localState: { remaining } };
  }
}

export class AttackHandler implements MultiFrameActionHandler<{ targetId: string }> {
  type = 'ATTACK';

  validate(ctx: ActionContext, action: Action<{ targetId: string }>): ValidationResult {
    const actor = ctx.world.entities[action.actorId];
    if (!actor) return { valid: false, reason: 'Actor not found' };

    const combat = getComponent<CombatComponent>(actor, 'combat');
    if (!combat) return { valid: false, reason: 'Actor has no combat component' };

    const target = ctx.world.entities[action.payload!.targetId];
    if (!target) return { valid: false, reason: 'Target not found' };

    const targetHealth = getComponent<HealthComponent>(target, 'health');
    if (!targetHealth || targetHealth.current <= 0) return { valid: false, reason: 'Target is already dead or has no health' };

    return { valid: true };
  }

  start(ctx: ActionContext, action: Action<{ targetId: string }>) {
    // Immediate attack for now (could add wind-up frames local state)
    return {};
  }

  step(ctx: ActionContext, state: any): MultiFrameActionStepResult {
    const actor = ctx.world.entities[state.action.actorId];
    const target = ctx.world.entities[state.action.payload.targetId];

    if (!target) return { status: 'failed', failureReason: 'Target disappeared', events: [] };

    const pos = getComponent<PositionComponent>(actor, 'position');
    const targetPos = getComponent<PositionComponent>(target, 'position');
    const combat = getComponent<CombatComponent>(actor, 'combat')!;
    
    if (pos && targetPos) {
      const dist = distance(pos, targetPos);
      if (dist > combat.range) {
        return { status: 'failed', failureReason: 'Target out of range', events: [] };
      }
    }

    const targetHealth = getComponent<HealthComponent>(target, 'health')!;
    targetHealth.current = Math.max(0, targetHealth.current - combat.damage);

    const events: GameEvent[] = [
      {
        type: 'damage',
        frame: ctx.frame,
        actorId: state.action.actorId,
        targetId: target.id,
        damage: combat.damage,
        currentBefore: targetHealth.current + combat.damage,
        currentAfter: targetHealth.current
      } as any // Use as any to bypass strict type if missing fields
    ];

    if (targetHealth.current <= 0) {
      events.push({
        type: 'death',
        frame: ctx.frame,
        actorId: state.action.actorId,
        targetId: target.id
      } as any);
    }

    return { status: 'done', events };
  }
}

export class PickUpHandler implements MultiFrameActionHandler<{ targetId: string }> {
  type = 'PICK_UP';

  validate(ctx: ActionContext, action: Action<{ targetId: string }>): ValidationResult {
    const actor = ctx.world.entities[action.actorId];
    if (!actor) return { valid: false, reason: 'Actor not found' };
    
    const target = ctx.world.entities[action.payload!.targetId];
    if (!target) return { valid: false, reason: 'Target not found' };
    
    const collectible = getComponent<CollectibleComponent>(target, 'collectible');
    if (!collectible || collectible.collectedBy) return { valid: false, reason: 'Item not collectible or already collected' };

    return { valid: true };
  }

  start() { return {}; }

  step(ctx: ActionContext, state: any): MultiFrameActionStepResult {
    const actor = ctx.world.entities[state.action.actorId];
    const target = ctx.world.entities[state.action.payload.targetId];

    if (!target) return { status: 'failed', failureReason: 'Item disappeared', events: [] };

    const pos = getComponent<PositionComponent>(actor, 'position');
    const targetPos = getComponent<PositionComponent>(target, 'position');
    
    if (pos && targetPos) {
      // Hardcode pickup radius to 1.0 for now, could be dynamic
      if (distance(pos, targetPos) > 1.0) {
        return { status: 'failed', failureReason: 'Item out of pickup range', events: [] };
      }
    }

    const collectible = getComponent<CollectibleComponent>(target, 'collectible')!;
    collectible.collectedBy = actor.id;

    let inventory = getComponent<InventoryComponent>(actor, 'inventory');
    if (!inventory) {
      inventory = { counts: {} };
      setComponent(actor, 'inventory', inventory);
    }
    
    inventory.counts[collectible.kind] = (inventory.counts[collectible.kind] || 0) + 1;

    return {
      status: 'done',
      events: [{
        type: 'pickup',
        frame: ctx.frame,
        actorId: actor.id,
        targetId: target.id
      } as any]
    };
  }
}
