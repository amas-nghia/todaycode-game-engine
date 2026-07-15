export type EntityId = string;
export type ComponentType = string;

export type ComponentMap = Record<ComponentType, unknown>;

export interface Entity {
  id: EntityId;
  kind: string;
  components: ComponentMap;
}

/**
 * Gets a component from an entity if it exists.
 */
export function getComponent<T>(entity: Entity, component: ComponentType): T | undefined {
  return entity.components[component] as T | undefined;
}

/**
 * Checks if an entity has a specific component.
 */
export function hasComponent(entity: Entity, component: ComponentType): boolean {
  return entity.components[component] !== undefined;
}

/**
 * Mutates the entity by adding or updating a component.
 */
export function setComponent<T>(entity: Entity, component: ComponentType, data: T): void {
  entity.components[component] = data;
}

/**
 * Mutates the entity by removing a component.
 */
export function removeComponent(entity: Entity, component: ComponentType): void {
  delete entity.components[component];
}

/**
 * Returns a new entity with the added component (immutable).
 */
export function withComponent<T>(entity: Entity, component: ComponentType, data: T): Entity {
  return {
    ...entity,
    components: {
      ...entity.components,
      [component]: data,
    },
  };
}

/**
 * Returns a new entity without the specified component (immutable).
 */
export function withoutComponent(entity: Entity, component: ComponentType): Entity {
  const newComponents = { ...entity.components };
  delete newComponents[component];
  return {
    ...entity,
    components: newComponents,
  };
}
