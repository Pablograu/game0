import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Animation,
  Vector3,
} from '@babylonjs/core';

class LootManager {
  scene: Scene;
  isInitialized: boolean = false;

  constructor() {}

  init(scene: Scene) {
    if (this.isInitialized) {
      return;
    }
    this.scene = scene;
    this.isInitialized = true;
  }

  spawnLoot(position: Vector3) {
    if (!this.isInitialized) {
      return;
    }
    console.log('<<< loot spawned >>>');
    const loot = MeshBuilder.CreateBox(
      'loot',
      { width: 0.2, height: 1.5, depth: 0.2 },
      this.scene,
    );
    loot.position = position.clone().add(new Vector3(0, 1, 0)); // Spawn slightly above the ground
    loot.material = new StandardMaterial('lootMat', this.scene);
    (loot.material as StandardMaterial).diffuseColor = new Color3(1, 0.84, 0); // Gold colorw

    // Add a simple floating animation
    const anim = new Animation(
      'floatAnim',
      'position.y',
      30,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CYCLE,
    );

    const keys = [
      { frame: 0, value: loot.position.y },
      { frame: 30, value: loot.position.y + 0.5 },
      { frame: 60, value: loot.position.y },
    ];

    anim.setKeys(keys);
    loot.animations = [anim];
    this.scene.beginAnimation(loot, 0, 60, true);
  }
}

export default LootManager;
