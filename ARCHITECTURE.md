# 🎮 Game0 - Arquitectura Simplificada

## 📋 Visión General

Juego de acción 3D con combate rápido de puños, movimiento fluido y enemigos con IA básica. Construido con **Babylon.js v7** y **Havok Physics**.

---

## 🏗️ Estructura del Proyecto

```
src/
├── main.ts                  # Inicialización del juego y escena
├── PlayerController.ts      # Control del jugador (movimiento + combate + salud)
├── WeaponSystem.ts          # Sistema de hitbox y detección de golpes
├── EnemyDummy.ts            # IA de enemigos (patrulla + persecución + combate)
├── CameraShaker.ts          # Efectos de shake en cámara
├── EffectManager.ts         # Sistema de partículas centralizado
└── DebugGUI.ts              # Panel de debug
```

---

## 🎯 Componentes Principales

### 1️⃣ **PlayerController** (~700 líneas)

**Responsabilidades:**

- ✅ Movimiento fluido con física Havok
- ✅ Salto con Coyote Time y Jump Buffer
- ✅ Dash rápido con feedback visual
- ✅ Sistema de combate (puños rápidos alternados)
- ✅ Sistema de salud con invulnerabilidad
- ✅ Gestión de animaciones con blending

**Sistema de Animaciones:**

- Usa **directamente** `AnimationGroup` de Babylon.js
- Map de animaciones: `animationGroups: Map<string, AnimationGroup>`
- Variable de estado: `currentPlayingAnimation: string`
- Blending suave configurado en todos los grupos

**Animaciones disponibles:**

- `idle` - Idle estático
- `run` - Correr
- `jump` - Salto/caída
- `punch_l` - Puño izquierdo
- `punch_r` - Puño derecho

**Sistema de Combate:**

- Spam de puños sin cooldown
- Alternancia automática izquierda → derecha
- Velocidad de animación: `punchSpeed = 2.5x`
- Hitbox activa al 15% de la animación

---

### 2️⃣ **WeaponSystem** (~250 líneas)

**Responsabilidades:**

- ✅ Gestión de hitbox frente al jugador
- ✅ Detección de colisiones con enemigos y objetos
- ✅ Feedback de impacto (partículas, hitstop, shake)

**Simplificaciones:**

- ❌ **Eliminado:** Sistema de cooldown (no necesario)
- ❌ **Eliminado:** `tryAttack()`, `startAttack()` (lógica movida a PlayerController)
- ✅ **Simplificado:** `updateHitboxPosition()` - una sola búsqueda del modelo

**Hitbox:**

- Tamaño: `1.5 x 1 x 1.5`
- Offset: `1.2` unidades frente al jugador
- Actualización cada frame basada en rotación del modelo

---

### 3️⃣ **EffectManager** (Sistema Centralizado)

**Partículas gestionadas:**

- 🌫️ Polvo: salto, aterrizaje
- 💨 Dash: rastro de velocidad
- ✨ Hit sparks: impactos

**Ventajas:**

- Una sola fuente de verdad para efectos visuales
- Configuración centralizada
- Fácil de ajustar globalmente

---

### 4️⃣ **EnemyDummy** (IA Básica)

**Estados:**

1. **Patrulla** - Movimiento aleatorio
2. **Persecución** - Sigue al jugador en rango de visión
3. **Ataque** - Daño por contacto

**Configuración:**

- HP: `3`
- Velocidad patrulla: `2`
- Velocidad persecución: `4`
- Rango de visión: `2`
- Daño por contacto: `1`

---

## 🔧 Sistemas Técnicos

### **Física (Havok)**

- Motor: `HavokPlugin` con gravedad `-9.81`
- Jugador: Cápsula con `PhysicsAggregate`
- Enemigos: Cajas con física dinámica
- Terreno: Plano estático con fricción

### **Cámara (ArcRotate)**

- Distancia: `3-20` unidades
- Colisiones habilitadas
- Target fijo en jugador
- Shake reactivo a impactos

### **Animaciones (AnimationGroup nativo)**

- Blending habilitado en todos los grupos
- Velocidad de blending: `0.1` (rápida pero suave)
- Sin wrapper custom - uso directo de Babylon.js

---

## 📊 Métricas de Rendimiento

| Métrica                        | Valor            | Notas                           |
| ------------------------------ | ---------------- | ------------------------------- |
| **Líneas de código**           | ~1,600           | PlayerController + WeaponSystem |
| **Sistemas de partículas**     | 1 (centralizado) | EffectManager                   |
| **Abstracción de animaciones** | 0                | Uso directo de AnimationGroup   |
| **Búsquedas de modelo/frame**  | 1                | En updateHitboxPosition         |

---

## 🎨 Mejores Prácticas Implementadas

### ✅ **DO (lo que hacemos)**

- Usar `AnimationGroup` nativo de Babylon
- Física con Havok (motor recomendado v7)
- EffectManager centralizado para partículas
- Observables para input (`onKeyboardObservable`)
- Rotación con `Quaternion` + `Slerp`

### ❌ **DON'T (lo que evitamos)**

- ~~Crear wrappers innecesarios de AnimationGroup~~
- ~~Duplicar sistemas de partículas (local + global)~~
- ~~Buscar modelos múltiples veces por frame~~
- ~~Código muerto (cooldowns no usados)~~

---

## 🚀 Flujo de Juego

```
Inicialización (main.ts)
    ↓
Crear Escena + Física Havok
    ↓
Cargar Modelo del Jugador (GLB con animaciones)
    ↓
Crear PlayerController
    ├─→ Setup Input (Observables)
    ├─→ Setup Physics (Havok)
    ├─→ Setup WeaponSystem
    ├─→ Setup Animations (Map de AnimationGroups)
    └─→ Setup Update Loop
    ↓
Crear Enemigos (EnemyDummy)
    ├─→ Registrar en WeaponSystem
    └─→ Iniciar IA (patrulla/persecución)
    ↓
Render Loop (60 FPS)
    ├─→ PlayerController.update()
    │   ├─→ Movimiento + Física
    │   ├─→ Animaciones + Rotación
    │   └─→ Combate (si isAttacking)
    ├─→ WeaponSystem.update()
    │   ├─→ Actualizar hitbox position
    │   └─→ Detectar colisiones
    └─→ EnemyDummy.update() (cada enemigo)
        ├─→ IA (patrulla/persigue/ataca)
        └─→ Animaciones
```

---

## 🛠️ Configuración y Tunear

### **Movimiento**

```typescript
playerController.setMoveSpeed(8); // Velocidad de movimiento
playerController.setJumpForce(12); // Fuerza de salto
playerController.setDashSpeed(25); // Velocidad de dash
playerController.setCoyoteTime(0.12); // Gracia al caer
```

### **Combate**

```typescript
// En PlayerController
punchSpeed = 2.5; // Velocidad de animación de puño
punchHitboxDelay = 0.15; // Cuándo activar hitbox (15%)
attackMoveSpeedMultiplier = 0.1; // Reducción movimiento al atacar

// En WeaponSystem
damage = 1; // Daño por golpe
attackDuration = 0.15; // Duración de hitbox activa
hitboxSize = (1.5, 1, 1.5); // Tamaño de hitbox
hitboxOffset = 1.2; // Distancia frente al jugador
```

### **Cámara**

```typescript
camera.lowerRadiusLimit = 3; // Zoom mínimo
camera.upperRadiusLimit = 20; // Zoom máximo
camera.checkCollisions = true; // Colisiones con geometría
```

---

## 📝 Notas de Versión

### **v0.2 - Simplificación** (Actual)

- ❌ Eliminado `AnimationHandler` custom
- ❌ Eliminado sistema de partículas local
- ❌ Eliminado código muerto en WeaponSystem
- ✅ Simplificado `updateHitboxPosition()`
- ✅ Simplificado `updateRotation()`
- ✅ Todas partículas vía EffectManager

### **v0.1 - Prototipo Inicial**

- Movimiento + salto + dash
- Combate básico con combo
- Enemigos con IA simple
- Partículas duplicadas (local + EffectManager)

---

## 🎯 Próximos Pasos (Roadmap)

1. **Separar PlayerController en módulos:**
   - `PlayerMovement.ts` - WASD, salto, dash
   - `PlayerCombat.ts` - puños, hitbox
   - `PlayerHealth.ts` - vida, daño, respawn
   - `PlayerAnimations.ts` - gestión de anims

2. **Mejorar EnemyDummy:**
   - Añadir animaciones de ataque
   - Estados adicionales (stun, muerte)

3. **Niveles y progresión:**
   - Sistema de oleadas
   - Power-ups

---

**Última actualización:** Febrero 2026  
**Babylon.js:** v7.x  
**Física:** Havok
