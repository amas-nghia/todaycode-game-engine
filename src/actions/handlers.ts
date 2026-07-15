import { Action, ActionContext, ValidationResult } from '../actions';
import { MultiFrameActionHandler, MultiFrameActionStepResult } from '../multi-frame-action';
import { getComponent, setComponent, hasComponent } from '../entity';
import { PositionComponent, MovementComponent, MotionComponent, CombatComponent, HealthComponent, CollectibleComponent, InventoryComponent } from '../components';
import { isPositionInBounds, isSegmentClear, distance } from '../physics';
import { GameEvent } from '../events';

export class MoveDirectionHandler implements MultiFrameActionHandler<{ direction: 'up' | 'down' | 'left' | 'right' }> {
  type = 'MOVE_DIRECTION';

  validate(ctx: ActionContext, action: Action<{ direction: 'up' | 'down' | 'left' | 'right' }>): ValidationResult {
    const actor = ctx.world.entities[action.actorId];
    if (!actor) return { valid: false, reason: 'Actor not found' };
    
    const pos = getComponent<PositionComponent>(actor, 'position');
    if (!pos) return { valid: false, reason: 'Actor has no position' };

    const mov = getComponent<MovementComponent>(actor, 'movement');
    if (!mov) return { valid: false, reason: 'Actor has no movement component' };

    return { valid: true };
  }

  start(ctx: ActionContext, action: Action<{ direction: 'up' | 'down' | 'left' | 'right' }>) {
    const actor = ctx.world.entities[action.actorId];
    const pos = getComponent<PositionComponent>(actor, 'position')!;
    const mov = getComponent<MovementComponent>(actor, 'movement')!;
    
    const target = { x: pos.x, y: pos.y };
    const dir = action.payload!.direction;
    
    if (dir === 'up') target.y += mov.stepDistance;
    else if (dir === 'down') target.y -= mov.stepDistance;
    else if (dir === 'left') target.x -= mov.stepDistance;
    else if (dir === 'right') target.x += mov.stepDistance;

    if (!isPositionInBounds(ctx.world, target)) {
      return { localState: { blocked: true, target, reason: 'Target out of bounds' } };
    }

    const actorRadius = actor.components.collision ? (actor.components.collision as any).radius : 0;
    if (!isSegmentClear(ctx.world, pos, target, action.actorId, actorRadius)) {
      return { localState: { blocked: true, target, reason: 'Path blocked' } };
    }

    setComponent(actor, 'motion', {
      from: { x: pos.x, y: pos.y },
      target,
      remainingDistance: distance(pos, target)
    } as MotionComponent);

    return { localState: { target } };
  }

  step(ctx: ActionContext, state: any): MultiFrameActionStepResult {
    if (state.localState?.blocked) {
      const actor = ctx.world.entities[state.action.actorId];
      const pos = getComponent<PositionComponent>(actor, 'position')!;

      return {
        status: 'done',
        events: [{
          type: 'move_blocked',
          frame: ctx.frame,
          actorId: state.action.actorId,
          from: { x: pos.x, y: pos.y },
          to: state.localState.target,
        }],
      };
    }

    const actor = ctx.world.entities[state.action.actorId];
    // If motion component was removed (by MovementSystem), we're done
    if (!hasComponent(actor, 'motion')) {
      return { status: 'done', events: [] };
    }

    return { status: 'running', events: [] };
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
