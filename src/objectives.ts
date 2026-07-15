import { WorldState } from './world';

import { distance } from './physics';
import { getComponent } from './entity';
import { PositionComponent, InventoryComponent } from './components';

export interface ObjectiveCondition {
  type: string;
  actorId?: string;
  targetId?: string;
  targetPos?: { x: number; y: number }; // keeping for backward compatibility
  position?: { x: number; y: number };
  radius?: number;
  count?: number;
  kind?: string;
  metric?: string;
  operator?: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value?: number;
  conditions?: ObjectiveCondition[]; // for all/any
}

export type ObjectiveEvaluator = (world: WorldState, condition: ObjectiveCondition) => boolean;

export class ObjectiveSystem {
  private evaluators = new Map<string, ObjectiveEvaluator>();

  constructor() {
    this.registerStandardEvaluators();
  }

  registerEvaluator(type: string, evaluator: ObjectiveEvaluator): void {
    this.evaluators.set(type, evaluator);
  }

  evaluate(world: WorldState, condition: ObjectiveCondition): boolean {
    const evaluator = this.evaluators.get(condition.type);
    if (!evaluator) {
      throw new Error(`Unknown objective type: ${condition.type}`);
    }
    return evaluator(world, condition);
  }

  private registerStandardEvaluators(): void {
    this.registerEvaluator('all', (world, cond) => {
      if (!cond.conditions) return true;
      return cond.conditions.every(c => this.evaluate(world, c));
    });

    this.registerEvaluator('any', (world, cond) => {
      if (!cond.conditions) return true;
      return cond.conditions.some(c => this.evaluate(world, c));
    });

    this.registerEvaluator('defeat_all', (world) => {
      for (const id of world.order) {
        if (world.entities[id].kind === 'enemy') {
          // If alive logic is defined in health component, we check it.
          // Fallback to checking if the entity exists.
          const health = world.entities[id].components['health'] as any;
          if (!health || health.current > 0) {
             return false;
          }
        }
      }
      return true;
    });

    this.registerEvaluator('reach_position', (world, cond) => {
      if (!cond.actorId || !cond.position || cond.radius === undefined) return false;
      const actor = world.entities[cond.actorId];
      if (!actor) return false;
      const pos = getComponent<PositionComponent>(actor, 'position');
      if (!pos) return false;
      return distance(pos, cond.position) <= cond.radius;
    });

    this.registerEvaluator('reach_entity', (world, cond) => {
      if (!cond.actorId || !cond.targetId || cond.radius === undefined) return false;
      const actor = world.entities[cond.actorId];
      const target = world.entities[cond.targetId];
      if (!actor || !target) return false;
      const pos = getComponent<PositionComponent>(actor, 'position');
      const targetPos = getComponent<PositionComponent>(target, 'position');
      if (!pos || !targetPos) return false;
      return distance(pos, targetPos) <= cond.radius;
    });

    this.registerEvaluator('collect_count', (world, cond) => {
      if (!cond.actorId || !cond.kind || cond.count === undefined) return false;
      const actor = world.entities[cond.actorId];
      if (!actor) return false;
      const inventory = getComponent<InventoryComponent>(actor, 'inventory');
      if (!inventory) return false;
      return (inventory.counts[cond.kind] || 0) >= cond.count;
    });

    this.registerEvaluator('metric_comparison', (world, cond) => {
      if (!cond.metric || cond.value === undefined || !cond.operator) return false;
      const actual = world.metrics[cond.metric] || 0;
      switch (cond.operator) {
        case 'gt': return actual > cond.value;
        case 'lt': return actual < cond.value;
        case 'eq': return actual === cond.value;
        case 'gte': return actual >= cond.value;
        case 'lte': return actual <= cond.value;
        default: return false;
      }
    });
  }
}
