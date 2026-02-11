import {
  Vector3,
  ParticleSystem,
  Color4,
  Texture,
} from '@babylonjs/core';

/**
 * EffectManager - Singleton para gestionar efectos visuales de partículas
 */
class EffectManagerClass {
  scene: any = null;
  isInitialized: boolean = false;

  constructor() {}

  init(scene: any) {
    if (this.isInitialized) return;
    this.scene = scene;
    this.isInitialized = true;
    console.log('EffectManager initialized');
  }

  showHitSpark(position: any, options: any = {}) {
    if (!this.isInitialized) return;

    const particles = new ParticleSystem("sparks", 30, this.scene);
    particles.particleTexture = new Texture("https://www.babylonjs-playground.com/textures/flare.png", this.scene);
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
    setTimeout(() => { particles.stop(); particles.dispose(); }, 300);
  }

  showDust(position: any, options: any = {}) {
    if (!this.isInitialized) return;

    const particles = new ParticleSystem("dust", 15, this.scene);
    particles.particleTexture = new Texture("https://www.babylonjs-playground.com/textures/flare.png", this.scene);
    particles.emitter = position.clone();
    
    particles.minSize = 0.1;
    particles.maxSize = 0.3;
    particles.minLifeTime = 0.3;
    particles.maxLifeTime = 0.6;
    
    particles.emitRate = 200;
    
    const dir = options.direction || 'up';
    if (dir === 'radial') {
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
    setTimeout(() => { particles.stop(); particles.dispose(); }, 600);
  }

  showDashTrail(position: any, direction: any, options: any = {}) {
    if (!this.isInitialized) return;

    const particles = new ParticleSystem("trail", 20, this.scene);
    particles.particleTexture = new Texture("https://www.babylonjs-playground.com/textures/flare.png", this.scene);
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
    setTimeout(() => { particles.stop(); particles.dispose(); }, 400);
  }

  dispose() {
    this.isInitialized = false;
  }
}

export const EffectManager = new EffectManagerClass();
