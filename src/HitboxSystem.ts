import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Mesh,
  Scene,
} from "@babylonjs/core";

/**
 * Sistema de hitbox reutilizable para cualquier entidad
 * Maneja creación, posicionamiento y visualización
 */
export class HitboxSystem {
  private mesh: Mesh;
  private isActive: boolean = false;
  private debugMode: boolean = false;
  private material: StandardMaterial;

  constructor(
    name: string,
    size: Vector3,
    scene: Scene,
    debugMode: boolean = false,
  ) {
    this.debugMode = debugMode;

    // Crear mesh
    this.mesh = MeshBuilder.CreateBox(
      name,
      {
        width: size.x,
        height: size.y,
        depth: size.z,
      },
      scene,
    );

    this.mesh.parent = null;
    this.mesh.isPickable = false;
    this.mesh.checkCollisions = false;

    // Material
    this.material = new StandardMaterial(`${name}Mat`, scene);

    if (debugMode) {
      this.material.diffuseColor = new Color3(1, 0.3, 0.3);
      this.material.alpha = 0.3;
    } else {
      this.material.alpha = 0;
    }
    this.mesh.material = this.material;

    // Inicialmente desactivado
    this.setEnabled(false);
  }

  /**
   * Posiciona el hitbox en una ubicación con offset opcional
   */
  setPosition(
    position: Vector3,
    offsetDistance: number = 0,
    direction?: Vector3,
  ) {
    let finalPos = position.clone();

    if (offsetDistance > 0 && direction) {
      finalPos = position.add(direction.normalize().scale(offsetDistance));
    }

    this.mesh.position = finalPos;
  }

  /**
   * Rota el hitbox basado en un quaternion
   */
  setRotation(quaternion: any) {
    if (quaternion) {
      this.mesh.rotationQuaternion = quaternion.clone();
    }
  }

  /**
   * Detecta si intersecta con otro mesh
   */
  intersectsMesh(otherMesh: Mesh, precise: boolean = false): boolean {
    return this.mesh.intersectsMesh(otherMesh, precise);
  }

  /**
   * Activa/desactiva el hitbox
   */
  setEnabled(enabled: boolean) {
    this.isActive = enabled;
    this.mesh.setEnabled(enabled);
    if (this.debugMode && this.material) {
      this.mesh.visibility = enabled ? 0.5 : 0;
    }
  }

  /**
   * Alterna el estado
   */
  toggle() {
    this.setEnabled(!this.isActive);
  }

  /**
   * Obtiene el mesh interno (por si lo necesitas directamente)
   */
  getMesh(): Mesh {
    return this.mesh;
  }

  /**
   * Limpia recursos
   */
  dispose() {
    if (this.mesh) {
      this.mesh.dispose();
    }
    if (this.material) {
      this.material.dispose();
    }
  }

  isEnabled(): boolean {
    return this.isActive;
  }

  setDebugMode(enabled: boolean) {
    this.debugMode = enabled;
    if (this.material) {
      if (enabled) {
        this.material.diffuseColor = new Color3(1, 0.3, 0.3);
        this.mesh.visibility = this.isActive ? 0.3 : 0;
      } else {
        this.material.alpha = 0;
        this.mesh.visibility = 0;
      }
    }
  }
}
