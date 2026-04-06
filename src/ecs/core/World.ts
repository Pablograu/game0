import type { ComponentType } from "./Component.ts";
import type { EntityId } from "./Entity.ts";
import type { EcsSystem } from "./System.ts";
import { SystemRunner } from "./SystemRunner.ts";

export class World {
  private nextEntityId = 1;
  private entities = new Set<EntityId>();
  private componentStores = new Map<symbol, Map<EntityId, unknown>>();
  private systemRunner = new SystemRunner();

  createEntity(): EntityId {
    const entityId = this.nextEntityId++;
    this.entities.add(entityId);
    return entityId;
  }

  destroyEntity(entityId: EntityId) {
    if (!this.entities.has(entityId)) {
      return;
    }

    this.entities.delete(entityId);

    for (const store of this.componentStores.values()) {
      store.delete(entityId);
    }
  }

  hasEntity(entityId: EntityId): boolean {
    return this.entities.has(entityId);
  }

  addComponent<T>(
    entityId: EntityId,
    componentType: ComponentType<T>,
    component: T,
  ): T {
    this.assertEntityExists(entityId);
    const store = this.getOrCreateStore(componentType);
    store.set(entityId, component);
    return component;
  }

  removeComponent<T>(entityId: EntityId, componentType: ComponentType<T>) {
    const store = this.componentStores.get(componentType.key);
    store?.delete(entityId);
  }

  getComponent<T>(
    entityId: EntityId,
    componentType: ComponentType<T>,
  ): T | undefined {
    const store = this.componentStores.get(componentType.key);
    return store?.get(entityId) as T | undefined;
  }

  hasComponent<T>(
    entityId: EntityId,
    componentType: ComponentType<T>,
  ): boolean {
    const store = this.componentStores.get(componentType.key);
    return store?.has(entityId) ?? false;
  }

  query(...componentTypes: ComponentType<unknown>[]): EntityId[] {
    if (componentTypes.length === 0) {
      return Array.from(this.entities);
    }

    return Array.from(this.entities).filter((entityId) => {
      return componentTypes.every((componentType) => {
        return this.hasComponent(entityId, componentType);
      });
    });
  }

  registerSystem(system: EcsSystem): EcsSystem {
    this.systemRunner.add(system);
    return system;
  }

  unregisterSystem(systemName: string) {
    this.systemRunner.remove(systemName);
  }

  update(deltaTime: number) {
    this.systemRunner.update(this, deltaTime);
  }

  getSystems(): readonly EcsSystem[] {
    return this.systemRunner.getSystems();
  }

  private assertEntityExists(entityId: EntityId) {
    if (!this.entities.has(entityId)) {
      throw new Error(`Entity ${entityId} does not exist in this world.`);
    }
  }

  private getOrCreateStore<T>(
    componentType: ComponentType<T>,
  ): Map<EntityId, unknown> {
    let store = this.componentStores.get(componentType.key);

    if (!store) {
      store = new Map<EntityId, unknown>();
      this.componentStores.set(componentType.key, store);
    }

    return store;
  }
}
