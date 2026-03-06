# Game Manager - Guía de Implementación y Extensión

## Descripción General

El **GameManager** implementa una máquina de estados para controlar el flujo de la partida. Proporciona una arquitectura escalable para agregar nuevas funcionalidades como contadores, efectos visuales, o transiciones.

---

## Estados de Juego

La máquina de estados gestiona 4 estados principales:

```
START → PLAYING → PAUSED → DEAD
  ↑                 ↑
  └─────────────────┘
```

### 1. **START** - Pantalla de Inicio

- Muestra un botón "START" con estilo oscuro
- Al presionar, activa **pointerlock** y cambia a **PLAYING**
- No se ejecuta ninguna lógica de juego

### 2. **PLAYING** - Juego Activo

- Ejecuta lógica de movimiento del jugador
- Ejecuta IA de enemigos
- Se puede pausar con **ESC** o **P**

### 3. **PAUSED** - Juego Pausado

- Detiene inputdel jugador: `playerController.detachControl()`
- Detiene IA de enemigos: `enemy.disableUpdate()`
- Libera el ratón (sale de pointerlock)
- Muestra pantalla "PAUSED" con botón RESUME
- Presionar **ESC** o **P** nuevamente reanuda

### 4. **DEAD** - Pantalla de Muerte

- Se activa cuando `playerController.currentHealth <= 0`
- Muestra "YOU'RE DEAD" + contador de enemigos derrotados
- Botón "RESTART" recarga la página
- Input y IA está bloqueado

---

## Arquitectura de Integración

### GameManager (Controlador Central)

**Archivo:** `src/GameManager.ts`

```typescript
// Crear instancia (en main.ts)
this.gameManager = new GameManager(this.scene, this.engine);

// Asignar referencias
this.gameManager.setPlayerController(this.playerController);
this.gameManager.setEnemies(this.enemies);
this.gameManager.setCamera(this.camera);

// Callbacks personalizados
this.gameManager.setOnStateChange((newState: GameState) => {
  // Lógica adicional al cambiar estado
});
```

**Métodos Públicos:**

- `startGame()` - START → PLAYING
- `pauseGame()` - PLAYING → PAUSED
- `resumeGame()` - PAUSED → PLAYING
- `gameOver()` - PLAYING → DEAD
- `restartGame()` - DEAD → recarga página
- `currentState: GameState` - Getter del estado actual
- `isPlaying(), isPaused(), isDead()` - Getters de conveniencia
- `onEnemyDefeated()` - Incrementa contador de kills (ver extensión)

### PlayerController (Integración)

**Archivo:** `src/PlayerController.ts`

**Métodos agregados:**

```typescript
// Asignar referencia al GameManager
setGameManager(gameManager: any)

// Desactivar input (Escape/P para pausar)
detachControl()

// Reactivar input
enableInput()
```

**Flujo de entrada:**

1. `setupInput()` verifica `this.inputEnabled` antes de procesar
2. Si `inputEnabled = false`, ignora teclado y ratón
3. Al morir, llama a `gameManager.gameOver()`

### EnemyController (Integración)

**Archivo:** `src/EnemyController.ts`

**Métodos agregados:**

```typescript
// Pausar actualizaciones de IA (NO mata el enemigo, solo pausa lógica)
disableUpdate();

// Reanudar actualizaciones de IA
enableUpdate();
```

**Flujo de pausa:**

1. `_update()` chequea `!this._updateEnabled` al inicio
2. Si está pausado, retorna sin procesar lógica de movimiento/ataque
3. Observables y estados se mantienen igual (permite reanudar sin problemas)

---

## Extensión: Contador de Enemigos Derrotados

Para integrar con un sistema de stats en el futuro:

### 1. **WeaponSystem notifica kill (Ejemplo)**

En `src/WeaponSystem.ts` o `src/HitboxSystem.ts`, cuando un enemigo muere:

```typescript
// Cuando se detecta hit letal
if (enemy.hp <= 0) {
  this.gameManager?.onEnemyDefeated();
}
```

### 2. **Mostrar en UI**

El GameManager ya almacena el contador:

```typescript
// En el panel DEAD (createDeadPanel):
statsText.text = `Enemies Defeated: ${this.enemyDefeatedCount}`;

// Obtener valor en cualquier momento:
const kills = this.gameManager.getEnemyDefeatedCount();

// Resetear para nueva partida:
this.gameManager.resetEnemyDefeatedCount();
```

### 3. **Persistencia (Opcional)**

Para guardar highscores:

```typescript
// En restartGame()
if (this.enemyDefeatedCount > localHighScore) {
  localStorage.setItem('game0_highScore', this.enemyDefeatedCount.toString());
}
```

---

## Flujo de Control Detallado

### Inicio del Juego

```
new Game()
  ├─ setupPlayerController()
  ├─ setupGameManager()  ← Crea GameManager
  │   └─ showStartScreen() ← Muestra botón START
  └─ startRenderLoop()

[Usuario presiona START]
  └─ gameManager.startGame()
      ├─ engine.enterPointerlock()
      ├─ camera.attachControl()
      ├─ playerController.enableInput()
      └─ enemies.forEach(e => e.enableUpdate())
```

### Pausa

```
[Usuario presiona ESC/P en PLAYING]
  └─ setupInputListeners() → pauseGame()
      ├─ playerController.detachControl()
      ├─ camera.detachControl()
      ├─ enemies.forEach(e => e.disableUpdate())
      ├─ releasePointerLock()
      └─ showPauseScreen()

[Usuario presiona ESC/P en PAUSED]
  └─ resumeGame()
      ├─ camera.attachControl()
      ├─ playerController.enableInput()
      ├─ enemies.forEach(e => e.enableUpdate())
      ├─ engine.enterPointerlock()
      └─ hidePauseScreen()
```

### Muerte

```
playerController.takeDamage() → currentHealth <= 0
  └─ die()
      └─ gameManager.gameOver()  ← Después de 500ms
          ├─ playerController.detachControl()
          ├─ enemies.forEach(e => e.disableUpdate())
          ├─ releasePointerLock()
          └─ showDeadScreen()

[Usuario presiona RESTART]
  └─ location.reload()  ← Recarga la página
```

---

## Personalización de UI

Los estilos de botones se pueden modificar en `GameManager.ts`:

```typescript
// Colores de botones (en createStartPanel, createPausePanel, etc)
startButton.background = '#2c3e50'; // Gris oscuro
resumeButton.background = '#27ae60'; // Verde
restartButton.background = '#e74c3c'; // Rojo

// Tamaños y fuentes
titleText.fontSize = 60;
startButton.width = 0.8;
startButton.cornerRadius = 10;
```

---

## Modificaciones Futuras Sugeridas

### 1. **Pantalla de Configuración**

```typescript
// Agregar estado CONFIG entre START y PLAYING
enum GameState {
  START,
  CONFIG, // ← Nuevo
  PLAYING,
  PAUSED,
  DEAD,
}

// En GameManager.setupInputListeners(), agregar tecla M para mute, etc
```

### 2. **Tutorial / Cutscene**

```typescript
// Agregar estado TUTORIAL
enum GameState {
  START,
  TUTORIAL, // ← Nuevo
  PLAYING,
  // ...
}
```

### 3. **Persistencia de Datos**

```typescript
// En GameManager:
public saveHighScore() {
  localStorage.setItem('game0_kills', this.enemyDefeatedCount.toString());
}

public loadHighScore(): number {
  return parseInt(localStorage.getItem('game0_kills') || '0');
}
```

### 4. **Animaciones de Transición**

```typescript
// En showStartScreen/hidePauseScreen, agregar fade animations:
this.startPanel.alpha = 0;
const fadeIn = new BABYLON.Animation(...);  // Animar alpha de 0→1
```

---

## Debugging

### Logs Automáticos

El GameManager logea todos los cambios de estado:

```
[GameManager] Estado: START -> PLAYING
[GameManager] Jugador pausó
[GameManager] Reanudando juego...
[GameManager] GAME OVER
[GameManager] Enemigos derrotados: 3
```

### Chequear Estado

```typescript
// En DebugGUI o consola:
console.log(game.gameManager.currentState); // "PLAYING"
console.log(game.gameManager.isPlaying()); // true
console.log(game.gameManager.getEnemyDefeatedCount()); // 5
```

---

## Notas Técnicas

### ¿Por qué `disableUpdate()` en lugar de `dispose()`?

- `dispose()` eliminaría el enemigo completamente
- `disableUpdate()` simplemente pausa la lógica (observable sigue activo)
- Permite reanudar sin recrear el objeto
- Mantiene coherencia con el estado del juego

### ¿Por qué flag `_updateEnabled` en EnemyController?

- Observable (`onBeforeRenderObservable`) no se puede pausar directamente
- La flag permite pausar solo la lógica sin eliminar el listener
- Más eficiente que remover/agregar observables continuamente

### ¿Por qué `inputEnabled` en PlayerController?

- Similar a enemigos, permite pausar input sin destruir listeners
- Es más rápido que remover/agregar KeyboardObservable
- Mantiene el estado interno limpio (`inputMap = {}`)

---

## Checklist para Nuevas Features

- [ ] ¿Necesita un nuevo estado? → Agregar a `enum GameState`
- [ ] ¿Necesita notificar al pausal juego? → Usar `gameManager.pauseGame()`
- [ ] ¿Necesita stats? → Usar `onEnemyDefeated()` y `getEnemyDefeatedCount()`
- [ ] ¿Necesita UI nueva? → Crear `createXxxPanel()` en GameManager
- [ ] ¿Necesita callback? → Usar `setOnStateChange()`
