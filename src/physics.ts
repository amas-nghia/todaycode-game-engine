import { WorldState } from './world';
import { getComponent, EntityId } from './entity';
import { PositionComponent, BlockingComponent, CollisionComponent } from './components';

export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

export function isPositionInBounds(world: WorldState, pos: { x: number; y: number }, radius: number = 0): boolean {
  if (!world.bounds) return true; // If no bounds, everything is in bounds
  const { minX, maxX, minY, maxY } = world.bounds;
  return (
    pos.x - radius >= minX &&
    pos.x + radius <= maxX &&
    pos.y - radius >= minY &&
    pos.y + radius <= maxY
  );
}

export function getBlockingEntities(world: WorldState): Array<{ id: EntityId; x: number; y: number; radius: number }> {
  const blockers = [];
  for (const id of world.order) {
    const entity = world.entities[id];
    const block = getComponent<BlockingComponent>(entity, 'blocking');
    const pos = getComponent<PositionComponent>(entity, 'position');
    const col = getComponent<CollisionComponent>(entity, 'collision');
    
    if (block?.blocksMovement && pos && col) {
      blockers.push({
        id,
        x: pos.x,
        y: pos.y,
        radius: col.radius
      });
    }
  }
  return blockers;
}

// Distance from point to line segment
function distancePointToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const l2 = Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2);
  if (l2 === 0) return distance({ x: px, y: py }, { x: x1, y: y1 });
  
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  
  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);
  
  return distance({ x: px, y: py }, { x: projX, y: projY });
}

export function isSegmentClear(
  world: WorldState, 
  from: { x: number; y: number }, 
  to: { x: number; y: number }, 
  actorId?: EntityId,
  actorRadius: number = 0
): boolean {
  const blockers = getBlockingEntities(world);
  
  for (const b of blockers) {
    if (actorId && b.id === actorId) continue;
    
    const dist = distancePointToSegment(b.x, b.y, from.x, from.y, to.x, to.y);
    if (dist < b.radius + actorRadius) {
      return false; // Collision detected
    }
  }
  
  return true;
}
