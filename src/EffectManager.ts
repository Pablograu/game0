import {
  Vector3,
  ParticleSystem,
  Color4,
  Texture,
  Scene,
} from "@babylonjs/core";

/**
 * EffectManager - Singleton para gestionar efectos visuales de partículas
 */
class EffectManagerClass {
  scene: Scene | null = null;
  isInitialized: boolean = false;

  constructor() {}

  init(scene: Scene) {
    if (this.isInitialized) {
      return;
    }
    this.scene = scene;
    this.isInitialized = true;
    console.log("EffectManager initialized");
  }

  showHitSpark(position: Vector3) {
    if (!this.isInitialized) {
      return;
    }

    const particles = new ParticleSystem("sparks", 30, this.scene);
    particles.particleTexture = new Texture(
      "https://www.babylonjs-playground.com/textures/flare.png",
      this.scene,
    );
    particles.emitter = position.clone();

    particles.minSize = 0.05;
    particles.maxSize = 0.15;
    particles.minLifeTime = 0.1;
    particles.maxLifeTime = 0.3;

    particles.emitRate = 300;
    particles.blendMode = ParticleSystem.BLENDMODE_ADD;

    particles.direction1 = new Vector3(-1, -1, -1);
    particles.direction2 = new Vector3(1, 1, 1);
    particles.minEmitPower = 3;
    particles.maxEmitPower = 8;

    particles.color1 = new Color4(1, 1, 1, 1);
    particles.color2 = new Color4(1, 0.8, 0.3, 1);
    particles.colorDead = new Color4(1, 0.3, 0, 0);

    particles.gravity = new Vector3(0, -10, 0);

    particles.start();
    setTimeout(() => {
      particles.stop();
      particles.dispose();
    }, 300);
  }

  showDust(position: Vector3, options: any = {}) {
    if (!this.isInitialized) {
      return;
    }

    const particles = new ParticleSystem("dust", 15, this.scene);
    particles.particleTexture = new Texture(
      "https://www.babylonjs-playground.com/textures/flare.png",
      this.scene,
    );
    particles.emitter = position.clone();

    particles.minSize = 0.1;
    particles.maxSize = 0.3;
    particles.minLifeTime = 0.3;
    particles.maxLifeTime = 0.6;

    particles.emitRate = 200;

    const dir = options.direction || "up";
    if (dir === "radial") {
      particles.direction1 = new Vector3(-1, 0.2, -1);
      particles.direction2 = new Vector3(1, 1, 1);
    } else {
      particles.direction1 = new Vector3(-0.5, 0.5, -0.5);
      particles.direction2 = new Vector3(0.5, 1.5, 0.5);
    }

    particles.minEmitPower = 1;
    particles.maxEmitPower = 3;

    particles.color1 = new Color4(0.7, 0.6, 0.5, 0.8);
    particles.color2 = new Color4(0.6, 0.5, 0.4, 0.6);
    particles.colorDead = new Color4(0.3, 0.3, 0.3, 0);

    particles.gravity = new Vector3(0, -2, 0);

    particles.start();
    setTimeout(() => {
      particles.stop();
      particles.dispose();
    }, 600);
  }

  showDashTrail(position: Vector3, direction: Vector3, options: any = {}) {
    if (!this.isInitialized) return;

    const particles = new ParticleSystem("trail", 20, this.scene);
    particles.particleTexture = new Texture(
      "https://www.babylonjs-playground.com/textures/flare.png",
      this.scene,
    );
    particles.emitter = position.clone();

    particles.minSize = 0.1;
    particles.maxSize = 0.25;
    particles.minLifeTime = 0.2;
    particles.maxLifeTime = 0.4;

    particles.emitRate = 200;
    particles.blendMode = ParticleSystem.BLENDMODE_ADD;

    particles.direction1 = direction.scale(-1);
    particles.direction2 = direction.scale(-0.5);
    particles.minEmitPower = 2;
    particles.maxEmitPower = 4;

    particles.color1 = new Color4(0.3, 0.8, 1, 0.9);
    particles.color2 = new Color4(0.5, 0.9, 1, 0.7);
    particles.colorDead = new Color4(0.2, 0.6, 1, 0);

    particles.gravity = Vector3.Zero();

    particles.start();
    setTimeout(() => {
      particles.stop();
      particles.dispose();
    }, 400);
  }

  /**
   * ===== BLOOD SPLASH =====
   * Fire-and-forget particle burst for hit/death feedback.
   * @param position  - World-space emitter position (aim at torso/chest).
   * @param options.intensity  - 'hit' (small) | 'death' (large burst). Default: 'hit'.
   * @param options.direction  - Direction away from attacker to bias the spray.
   */
  showBloodSplash(
    position: Vector3,
    options: { intensity?: "hit" | "death"; direction?: Vector3 } = {},
  ) {
    if (!this.isInitialized) {
      return;
    }

    const isDeath = options.intensity === "death";
    const capacity = isDeath ? 80 : 30;
    const lifetimeMs = isDeath ? 1000 : 500;

    const particles = new ParticleSystem("blood", capacity, this.scene);
    particles.particleTexture = new Texture(
      "https://www.babylonjs-playground.com/textures/flare.png",
      this.scene,
    );
    particles.emitter = position.clone();

    particles.minSize = isDeath ? 0.06 : 0.04;
    particles.maxSize = isDeath ? 0.18 : 0.12;
    particles.minLifeTime = isDeath ? 0.4 : 0.2;
    particles.maxLifeTime = isDeath ? 0.8 : 0.45;

    particles.emitRate = isDeath ? 300 : 200;
    // BLENDMODE_STANDARD keeps blood opaque red, not a glowing additive haze
    particles.blendMode = ParticleSystem.BLENDMODE_STANDARD;

    // Bias spray away from the attacker when a direction is supplied
    if (options.direction && options.direction.length() > 0.01) {
      const d = options.direction.normalize();
      particles.direction1 = new Vector3(d.x - 0.5, d.y + 0.3, d.z - 0.5);
      particles.direction2 = new Vector3(d.x + 0.5, d.y + 1.8, d.z + 0.5);
    } else {
      particles.direction1 = new Vector3(-1, 0.5, -1);
      particles.direction2 = new Vector3(1, 2.0, 1);
    }

    particles.minEmitPower = isDeath ? 3 : 1.5;
    particles.maxEmitPower = isDeath ? 9 : 5;

    // Deep red blood colour ramp
    particles.color1 = new Color4(0.7, 0.02, 0.02, 1.0);
    particles.color2 = new Color4(0.45, 0.0, 0.0, 0.8);
    particles.colorDead = new Color4(0.1, 0.0, 0.0, 0.0);

    // Match scene gravity so droplets arc realistically
    particles.gravity = new Vector3(0, -35, 0);

    particles.start();

    setTimeout(() => {
      particles.stop();
      particles.dispose();
    }, lifetimeMs);
  }

  dispose() {
    this.isInitialized = false;
  }
}

export const EffectManager = new EffectManagerClass();
