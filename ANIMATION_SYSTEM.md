# Sistema de Animaciones con AnimationHandler

## 📋 Características Implementadas

✅ **Animation Blending Suave**: Transiciones de 0.25s entre animaciones  
✅ **Loop Forzado**: Idle y Run con loop explícito activado  
✅ **Fix Root Motion**: El root permanece en (0, -1, 0) relativo a la cápsula  
✅ **Limpieza de Grupos**: Fade-out automático de animaciones anteriores  
✅ **One-Shot Animations**: Soporte para ataques/animaciones únicas  

---

## 🚀 Uso Básico

### Animaciones con Loop (Idle, Run, Jump)

```typescript
// El PlayerController ahora usa AnimationHandler automáticamente
// Las animaciones se cambian según el estado del jugador

// Idle: cuando el jugador está quieto en el suelo
// Run: cuando el jugador se mueve en el suelo  
// Jump: cuando el jugador está en el aire
```

### Cambio Manual de Animación

```typescript
// A través del PlayerController
playerController.switchAnimation('run')

// Directamente desde el AnimationHandler (más control)
if (playerController.animationHandler) {
  playerController.animationHandler.play('idle', { 
    loop: true,
    speed: 1.0 
  })
}
```

---

## 🎯 Uso Avanzado

### Animaciones One-Shot (Ataques)

Si en el futuro añades una animación de ataque:

```typescript
// En tu WeaponSystem o donde manejes el ataque:
if (playerController.animationHandler) {
  // Reproducir ataque una vez y volver a idle
  playerController.animationHandler.playOneShot('attack', 'idle', 1.5)
  //                                              ↑        ↑     ↑
  //                                          animación  volver speed
}
```

### Configurar Duración del Blending

```typescript
// Por defecto es 0.25 segundos
// Puedes cambiarlo en runtime:
playerController.animationHandler.setBlendDuration(0.5) // 500ms
```

### Verificar Estado de Animación

```typescript
const currentAnim = playerController.animationHandler.getCurrentAnimation()
console.log('Animación actual:', currentAnim) // 'idle', 'run', 'jump'

// Verificar si está reproduciendo un one-shot
if (playerController.animationHandler.isPlayingOneShotAnimation()) {
  console.log('No interrumpir, está atacando!')
}
```

---

## 🔧 Debug en lil-gui

El DebugGUI ahora incluye controles para el AnimationHandler:

**Player > Animation Blending**
- `Blend Duration`: Ajusta la duración de las transiciones (0-1s)
- `Manual Animation`: Selector para forzar una animación
- `Force Play`: Botón para reproducir la animación seleccionada manualmente

---

## 🐛 Solución de Problemas

### El personaje se mueve con la animación (Root Motion)

**Solucionado**: El AnimationHandler llama a `fixRootMotion()` cada frame para mantener el root en (0, -1, 0).

### Las animaciones no loopean

**Solucionado**: Todas las animaciones se configuran con `loopAnimation = true` al reproducirse.

### Transiciones abruptas

**Solucionado**: `enableBlending = true` y `blendingSpeed` configurados automáticamente.

### Múltiples animaciones activas

**Solucionado**: Al cambiar de animación, la anterior hace fade-out automático.

---

## 📦 Estructura de Archivos

```
src/
├── AnimationHandler.ts       # ⭐ Nueva clase
├── PlayerController.ts        # Refactorizado para usar AnimationHandler
├── DebugGUI.ts               # Añadidos controles de blending
└── main.ts                   # Sin cambios (solo carga los modelos)
```

---

## 🎮 Ejemplo: Añadir Animación de Ataque

Si cargas un modelo `attack.glb` en el futuro:

### 1. Cargar en main.ts

```typescript
const attackResult = await ImportMeshAsync("/models/attack.glb", this.scene)
const attackRoot = attackResult.meshes[0]!
attackRoot.parent = physicsBody
attackRoot.position = new Vector3(0, -1, 0)
attackRoot.scaling = new Vector3(1, 1, 1)
attackRoot.rotationQuaternion = Quaternion.FromEulerAngles(0, 0, 0)
attackRoot.setEnabled(false)

// Añadir a animationModels
;(physicsBody as any).animationModels.attack = {
  root: attackRoot,
  animations: attackResult.animationGroups
}
```

### 2. Usar en WeaponSystem

```typescript
// Cuando el jugador ataca
onAttackStart() {
  if (this.player.animationHandler) {
    // Determinar a qué volver según si está en movimiento
    const returnTo = this.player.isGrounded && this.player.isMoving ? 'run' : 'idle'
    
    this.player.animationHandler.playOneShot('attack', returnTo, 1.2)
  }
}
```

---

## 🎨 Ajustes Finos de Animación

### Velocidad de Animación

```typescript
// Correr más rápido visualmente
playerController.animationHandler.play('run', { 
  loop: true, 
  speed: 1.5  // 50% más rápido
})

// Salto en cámara lenta
playerController.animationHandler.play('jump', { 
  loop: true, 
  speed: 0.8  // 20% más lento
})
```

### Callback al Completar

```typescript
playerController.animationHandler.play('attack', {
  loop: false,
  speed: 1.0,
  onComplete: () => {
    console.log('¡Ataque completado!')
    // Lógica custom aquí
  }
})
```

---

## ⚡ Rendimiento

- **Fix Root Motion**: Se ejecuta cada frame pero es extremadamente ligero (3 asignaciones).
- **Blending**: Manejado nativamente por Babylon.js, sin overhead adicional.
- **Limpieza**: Los modelos ocultos se desactivan con `setEnabled(false)` para no renderizarse.

---

## 📝 Notas Técnicas

### ¿Por qué (0, -1, 0)?

La cápsula física tiene altura 2 (desde -1 a +1 en Y). El root del modelo se coloca en Y=-1 para que los pies del personaje estén al nivel del suelo.

### Rotación con Quaternion

Los modelos GLB usan `rotationQuaternion` por defecto. El AnimationHandler lo preserva al cambiar animaciones para mantener la orientación del personaje.

### Orden de Operaciones

1. `fadeOutAnimation()` detiene la animación anterior
2. Nuevo modelo se activa con `setEnabled(true)`
3. Rotación se restaura desde el modelo anterior
4. `fixRootMotion()` asegura posición correcta
5. Animación se inicia con `start()`
6. Cada frame: `update()` mantiene el root en su lugar

---

## 🔮 Futuras Mejoras

- [ ] Sistema de capas de animación (cuerpo superior/inferior independientes)
- [ ] IK para pies (ajustar a terreno irregular)
- [ ] Sincronización de animación con eventos de audio
- [ ] Sistema de mezcla de animaciones (additive blending)
- [ ] Curvas de transición customizables (ease-in, ease-out)

---

## 📞 Contacto

Si encuentras bugs o necesitas features adicionales, abre un issue o modifica `AnimationHandler.ts` directamente.

**¡Disfruta de animaciones suaves!** ✨
