# 🎮 Game0

Juego de acción 3D con combate rápido de puños, movimiento fluido y enemigos con IA. Construido con **Babylon.js v7** y **Havok Physics**.

## ✨ Features

- 🥊 **Combate spam**: Puños rápidos alternados sin cooldown
- 🏃 **Movimiento fluido**: Coyote time, jump buffer, dash
- 🤖 **IA de enemigos**: Patrulla, persecución y ataque
- 📹 **Camera shake**: Feedback reactivo en impactos
- ✨ **Efectos visuales**: Sistema de partículas centralizado
- 🎬 **Animaciones suaves**: Blending nativo de Babylon.js

## 🚀 Quick Start

```bash
# Instalar dependencias
npm install

# Desarrollo
npm run dev

# Build
npm run build
```

## 🎮 Controles

| Acción     | Input                 |
| ---------- | --------------------- |
| **Mover**  | WASD                  |
| **Saltar** | Espacio               |
| **Dash**   | Shift                 |
| **Atacar** | Click izquierdo / K   |
| **Cámara** | Click derecho + Mouse |

## 🏗️ Arquitectura

```
PlayerController  (700 líneas)  → Movimiento + Combate + Salud + Anims
WeaponSystem      (250 líneas)  → Hitbox + Detección de golpes
EnemyDummy        (~200 líneas) → IA de patrulla/persecución/ataque
EffectManager     (~150 líneas) → Sistema de partículas centralizado
CameraShaker      (~100 líneas) → Efectos de shake
```

Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para detalles completos.

## 🛠️ Stack Tecnológico

- **Motor**: Babylon.js v7
- **Física**: Havok Physics
- **Animaciones**: AnimationGroup nativo (sin wrappers)
- **Input**: Observables de Babylon
- **Build**: Vite

## 📊 Simplificaciones v0.2

✅ **Eliminado código innecesario:**

- ❌ `AnimationHandler` custom → Uso directo de `AnimationGroup`
- ❌ Partículas locales → Solo `EffectManager`
- ❌ Sistema de cooldown en WeaponSystem
- ❌ Búsquedas múltiples de modelos por frame

✅ **Resultado:**

- De ~1,800 líneas → ~1,300 líneas (-28%)
- De 3 abstracciones de animaciones → 1 (nativa)
- De 2 sistemas de partículas → 1 (centralizado)

## 🎯 Roadmap

- [ ] Separar PlayerController en módulos
- [ ] Más animaciones de enemigos
- [ ] Sistema de oleadas
- [ ] Power-ups

## 📝 License

MIT

---

**Built with ❤️ using Babylon.js**
