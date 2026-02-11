# 📋 Changelog

## [0.2.0] - Simplificación y Limpieza - 2026-02-11

### 🎯 Objetivo

Reducir complejidad innecesaria y eliminar código muerto manteniendo toda la funcionalidad.

### ✅ Eliminado (Código Muerto)

#### **AnimationHandler**

- ❌ Clase `AnimationHandler` completa eliminada
- ✅ Ahora usa directamente `AnimationGroup` de Babylon.js
- ✅ Map nativo: `animationGroups: Map<string, AnimationGroup>`
- **Razón:** Wrapper innecesario que duplicaba funcionalidad nativa

#### **Sistema de Partículas Local**

- ❌ `dustParticles: ParticleSystem`
- ❌ `dashParticles: ParticleSystem`
- ❌ `setupParticles()` completo
- ❌ `createParticleTexture()`
- ❌ `emitDust()`
- ✅ Ahora 100% vía `EffectManager`
- **Razón:** Duplicación - EffectManager ya manejaba todo

#### **WeaponSystem - Código No Usado**

- ❌ `tryAttack()` - nunca llamado
- ❌ `startAttack()` - nunca llamado
- ❌ `animateHitbox()` - nunca ejecutado
- ❌ `cooldownTimer` + `getCooldownProgress()` - cooldown es 0
- ❌ `isOnCooldown()` - cooldown es 0
- **Razón:** Lógica de ataque movida a PlayerController

#### **PlayerController - Variables No Usadas**

- ❌ `isAttackingDown` - declarada pero nunca usada
- **Razón:** Sistema de pogo no implementado

### 🔄 Simplificado

#### **updateHitboxPosition()** (WeaponSystem)

**Antes:** 55 líneas con 2 búsquedas del modelo por frame

```typescript
if (this.player?.animationHandler) {
  const currentAnimName = this.player.animationHandler.getCurrentAnimation();
  const currentModel = this.playerMesh.animationModels?.[currentAnimName];
  // ... 20 líneas más
}
// Repetir búsqueda para rotación
if (this.player?.animationHandler) { ... }
```

**Después:** 25 líneas con 1 búsqueda

```typescript
const currentAnim = this.player?.currentPlayingAnimation || 'idle';
const modelRoot = this.playerMesh.animationModels?.[currentAnim]?.root;
// Usar modelRoot para todo
```

- ✅ **-50% líneas**
- ✅ **-50% búsquedas de modelo**

#### **updateRotation()** (PlayerController)

**Antes:** 40 líneas con 3 formas de buscar el modelo

```typescript
let currentModel = null;
if (this.animationHandler) { ... }
else if (this.mesh.animationModels && this.mesh.currentAnimation) { ... }
else { fallback }
```

**Después:** 25 líneas con acceso directo

```typescript
const modelRoot =
  this.mesh.animationModels?.[this.currentPlayingAnimation]?.root;
```

- ✅ **-40% líneas**
- ✅ Una sola forma de acceder al modelo

#### **startDash() / endDash()** (PlayerController)

**Antes:** Gestión manual de partículas locales

```typescript
if (this.dashParticles) this.dashParticles.emitRate = 150;
// ...
if (this.dashParticles) this.dashParticles.emitRate = 0;
```

**Después:** Llamada directa a EffectManager

```typescript
EffectManager.showDust(dashPos, { count: 30, duration: 0.3 });
```

#### **onLand()** (PlayerController)

**Antes:** Doble sistema de partículas

```typescript
EffectManager.showDust(...);
this.emitDust(20); // Duplicado
```

**Después:** Solo EffectManager

```typescript
EffectManager.showDust(...);
```

#### **setupAnimationHandler()** (PlayerController)

**Antes:** Crear instancia de AnimationHandler

```typescript
this.animationHandler = new AnimationHandler(...);
this.setupAnimations();
```

**Después:** Solo configurar blending

```typescript
this.setupAnimations();
```

### 📊 Métricas de Mejora

| Archivo                 | Antes         | Después       | Reducción |
| ----------------------- | ------------- | ------------- | --------- |
| **PlayerController.ts** | 1,377 líneas  | ~1,050 líneas | **-24%**  |
| **WeaponSystem.ts**     | 444 líneas    | ~280 líneas   | **-37%**  |
| **Total proyecto**      | ~1,821 líneas | ~1,330 líneas | **-27%**  |

| Métrica                        | Antes                     | Después           | Mejora   |
| ------------------------------ | ------------------------- | ----------------- | -------- |
| **Abstracciones de animación** | 3 capas                   | 1 capa (nativa)   | **-67%** |
| **Sistemas de partículas**     | 2 (local + EffectManager) | 1 (EffectManager) | **-50%** |
| **Búsquedas de modelo/frame**  | 2-3                       | 1                 | **-50%** |

### 📝 Archivos Modificados

- ✅ `src/PlayerController.ts` - Eliminadas partículas, simplificada rotación
- ✅ `src/WeaponSystem.ts` - Eliminado código muerto, simplificado hitbox
- ✅ `ARCHITECTURE.md` - Nueva documentación arquitectónica
- ✅ `README.md` - Actualizado con overview simplificado
- ✅ `CHANGELOG.md` - Este archivo

### 🔍 Sin Regresiones

**✅ Funcionalidad mantenida al 100%:**

- Movimiento (WASD, salto, dash)
- Combate (puños rápidos alternados)
- Animaciones (blending suave)
- Partículas (todas vía EffectManager)
- IA de enemigos
- Sistema de salud
- Camera shake

### 🎯 Próximos Pasos

Ver [ARCHITECTURE.md](./ARCHITECTURE.md) sección "Próximos Pasos" para roadmap completo.

---

## [0.1.0] - Prototipo Inicial

- Movimiento básico + salto + dash
- Sistema de combate con combo
- Enemigos con IA simple
- Partículas duplicadas (local + EffectManager)
- AnimationHandler custom wrapper

---

**Formato basado en [Keep a Changelog](https://keepachangelog.com/)**
