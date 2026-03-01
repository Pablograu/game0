import {
  Scene,
  Vector3,
  AnimationGroup,
  AbstractMesh,
  TransformNode,
} from '@babylonjs/core'
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading'
import { EnemyController, EnemyConfig } from './EnemyController.ts'

/**
 * EnemyFactory — Carga un GLB una sola vez y clona instancias independientes
 * usando AssetContainer.instantiateModelsToScene().
 *
 * Cada clon tiene sus propias AnimationGroups independientes.
 */
export class EnemyFactory {
  private static containers: Map<string, any> = new Map()

  /**
   * Pre-carga el asset container para un modelo GLB.
   * Llamar una sola vez antes de spawnear enemigos.
   */
  static async preload(path: string, scene: Scene): Promise<void> {
    if (this.containers.has(path)) return

    console.log(`[EnemyFactory] Precargando: ${path}`)
    const container = await LoadAssetContainerAsync(path, scene)
    this.containers.set(path, container)

    console.log(
      `[EnemyFactory] Container listo: ${container.meshes.length} meshes, ` +
      `${container.animationGroups.length} animation groups ` +
      `(${container.animationGroups.map((ag: AnimationGroup) => ag.name).join(', ')})`,
    )
  }

  /**
   * Crea una instancia independiente del enemigo con su propio set de animaciones.
   * Cada llamada devuelve un EnemyController completamente independiente.
   */
  static spawn(
    path: string,
    scene: Scene,
    position: Vector3,
    config: EnemyConfig = {},
  ): EnemyController {
    const container = this.containers.get(path)
    if (!container) {
      throw new Error(
        `[EnemyFactory] Container para '${path}' no precargado. Llama a EnemyFactory.preload() primero.`,
      )
    }

    // Guardar nombres originales de las animaciones ANTES de instanciar
    const originalAnimNames = container.animationGroups.map((ag: AnimationGroup) => ag.name)

    // Instanciar modelo con animaciones independientes
    const instance = container.instantiateModelsToScene(
      (name: string) => `${name}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      false, // no clonar materiales (comparten material, más eficiente)
    )

    // Restaurar nombres originales de las animaciones (instantiateModelsToScene les pone el sufijo)
    for (let i = 0; i < instance.animationGroups.length; i++) {
      if (i < originalAnimNames.length) {
        instance.animationGroups[i].name = originalAnimNames[i]
      }
    }

    // Root node de la instancia
    const root = instance.rootNodes[0] as TransformNode
    root.position = position.clone()

    // Recoger todos los meshes de la instancia
    const meshes: AbstractMesh[] = []
    root.getChildMeshes(false).forEach((m: AbstractMesh) => {
      meshes.push(m)
    })

    // Animation groups independientes de esta instancia
    const animGroups: AnimationGroup[] = instance.animationGroups

    console.log(
      `[EnemyFactory] Spawned en (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}) — ` +
      `${meshes.length} meshes, ${animGroups.length} anims: [${animGroups.map(ag => ag.name).join(', ')}]`,
    )

    // Crear el controller
    const controller = new EnemyController(
      root,
      meshes,
      animGroups,
      scene,
      config,
    )

    return controller
  }

  /**
   * Spawns múltiples enemigos del mismo tipo.
   */
  static spawnMultiple(
    path: string,
    scene: Scene,
    positions: Vector3[],
    config: EnemyConfig = {},
  ): EnemyController[] {
    return positions.map((pos) => this.spawn(path, scene, pos, config))
  }

  /**
   * Limpia un container precargado.
   */
  static disposeContainer(path: string) {
    const container = this.containers.get(path)
    if (container) {
      container.dispose()
      this.containers.delete(path)
    }
  }

  /**
   * Limpia todos los containers.
   */
  static disposeAll() {
    for (const [path, container] of this.containers) {
      container.dispose()
    }
    this.containers.clear()
  }
}
