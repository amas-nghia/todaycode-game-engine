import { WorldState, getEntity } from './world';
import { Entity, EntityId, getComponent } from './entity';
import { PositionComponent, BlockingComponent } from './components';

import { distance, isSegmentClear, isPositionInBounds } from './physics';

/**
 * Finds the nearest entity matching a filter predicate.
 * Deterministic tie-breaking: by shortest distance, then by entity order.
 */
export function findNearest(
  world: WorldState,
  fromId: EntityId,
  filter: (entity: Entity) => boolean
): Entity | undefined {
  const fromEntity = getEntity(world, fromId);
  if (!fromEntity) return undefined;
  
  const fromPos = getComponent<PositionComponent>(fromEntity, 'position');
  if (!fromPos) return undefined;

  let nearestEntity: Entity | undefined;
  let minDistance = Infinity;

  // Iterate over order array to ensure deterministic tie-breaking
  for (const id of world.order) {
    if (id === fromId) continue;
    
    const entity = world.entities[id];
    if (!filter(entity)) continue;

    const targetPos = getComponent<PositionComponent>(entity, 'position');
    if (!targetPos) continue;

    const d = distance(fromPos, targetPos);
    
    // Strict less-than ensures the FIRST entity in deterministic order is preferred in a tie.
    if (d < minDistance) {
      minDistance = d;
      nearestEntity = entity;
    }
  }

  return nearestEntity;
}

export function isInBounds(world: WorldState, pos: { x: number; y: number }): boolean {
  return isPositionInBounds(world, pos, 0);
}

/**
 * Checks if a given position is occupied by any entity that blocks movement.
 */
export function isOccupied(world: WorldState, pos: { x: number; y: number }, radius: number = 0): boolean {
  // Can just do a segment clear check with 0 distance
  return !isSegmentClear(world, pos, pos, undefined, radius);
}

export function isPathClear(world: WorldState, fromPos: { x: number; y: number }, toPos: { x: number; y: number }, actorId?: EntityId, actorRadius: number = 0): boolean {
  return isSegmentClear(world, fromPos, toPos, actorId, actorRadius);
}

/**
 * Returns all entities visible from a given entity's perspective.
 */
export function visibleEntities(world: WorldState, actorId: EntityId): Entity[] {
  // Can be extended with line-of-sight checks. Default returns all entities.
  const result: Entity[] = [];
  for (const id of world.order) {
    if (id !== actorId) {
      result.push(world.entities[id]);
    }
  }
  return result;
}
