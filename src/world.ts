import { Entity, EntityId } from './entity';

export interface WorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface WorldState {
  frame: number;
  seed: number;
  rngState?: unknown;
  entities: Record<EntityId, Entity>;
  order: EntityId[];
  metrics: Record<string, number>;
  tags?: Record<string, EntityId[]>;
  bounds?: WorldBounds;
  level?: unknown;
}

/**
 * Creates a new, empty world state.
 */
export function createWorld(seed: number, frame: number = 0): WorldState {
  return {
    frame,
    seed,
    entities: {},
    order: [],
    metrics: {},
  };
}

/**
 * Adds an entity to the world state. Deterministically adds to the end of the order array.
 * Throws if the entity ID already exists.
 */
export function addEntity(world: WorldState, entity: Entity): void {
  if (world.entities[entity.id]) {
    throw new Error(`Entity with id ${entity.id} already exists`);
  }
  world.entities[entity.id] = entity;
  world.order.push(entity.id);
}

/**
 * Removes an entity from the world state by ID.
 * Keeps the order deterministic by using filter (or splice if found).
 */
export function removeEntity(world: WorldState, entityId: EntityId): void {
  if (!world.entities[entityId]) {
    return;
  }
  delete world.entities[entityId];
  const idx = world.order.indexOf(entityId);
  if (idx !== -1) {
    world.order.splice(idx, 1);
  }
}

/**
 * Retrieves an entity by ID from the world state.
 */
export function getEntity(world: WorldState, entityId: EntityId): Entity | undefined {
  return world.entities[entityId];
}

/**
 * Updates an entity in the world state.
 * Throws if the entity ID does not exist.
 */
export function updateEntity(world: WorldState, entity: Entity): void {
  if (!world.entities[entity.id]) {
    throw new Error(`Entity with id ${entity.id} does not exist`);
  }
  world.entities[entity.id] = entity;
}
