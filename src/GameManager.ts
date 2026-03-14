import {
  AdvancedDynamicTexture,
  TextBlock,
  Button,
  Control,
  StackPanel,
  Rectangle,
  Grid,
} from '@babylonjs/gui';
import { Scene, Vector3 } from '@babylonjs/core';

/**
 * Estados principales del juego
 */
export enum GameState {
  START = 'START', // Pantalla inicial
  PLAYING = 'PLAYING', // Juego activo
  PAUSED = 'PAUSED', // Juego pausado
  DEAD = 'DEAD', // Pantalla de muerte
}

/**
 * GameManager - Máquina de estados para controlar el flujo de la partida
 * Responsabilidades:
 * - Gestionar transiciones entre estados
 * - Controlar GUI (inicio, pausa, muerte)
 * - Sincronizar input (Escape/P para pausa)
 * - Detener/reanudar lógica de playerController y enemigos
 */
export class GameManager {
  private scene: Scene;
  private engine: any;
  private state: GameState = GameState.START;
  private uiTexture: AdvancedDynamicTexture | null = null;

  // Referencias a objetos del juego
  private playerController: any = null;
  private enemies: any[] = [];
  private camera: any = null;

  // Panels de UI
  private startPanel: Control | null = null;
  private pausePanel: Control | null = null;
  private deadPanel: Control | null = null;

  // Referencias a elementos UI del panel de inicio
  private titleText: TextBlock | null = null;
  private startButton: Button | null = null;

  // Callbacks para extensión futura (ej: contador de enemigos)
  private onStateChange: ((newState: GameState) => void) | null = null;
  private enemyDefeatedCount: number = 0;

  constructor(scene: Scene, engine: any) {
    this.scene = scene;
    this.engine = engine;
    this.initializeUI();
    this.setupInputListeners();
    // Los enemigos se desactivan aquí cuando se asignan (ver setEnemies)
  }

  /**
   * ===== SETTERS - Para vincular referencias después de crear los objetos =====
   */
  public setPlayerController(playerController: any) {
    this.playerController = playerController;
  }

  public setEnemies(enemies: any[]) {
    this.enemies = enemies;
    // Desactivar todos los enemigos inicialmente (el juego aún no ha comenzado)
    this.disableEnemies();
  }

  public setCamera(camera: any) {
    this.camera = camera;
  }

  public setOnStateChange(callback: (newState: GameState) => void) {
    this.onStateChange = callback;
  }

  /**
   * ===== UI ELEMENT GETTERS =====
   */
  public getTitleText(): TextBlock | null {
    return this.titleText;
  }

  public getStartButton(): Button | null {
    return this.startButton;
  }

  /**
   * ===== STATE GETTERS =====
   */
  public get currentState(): GameState {
    return this.state;
  }

  public isPlaying(): boolean {
    return this.state === GameState.PLAYING;
  }

  public isPaused(): boolean {
    return this.state === GameState.PAUSED;
  }

  public isDead(): boolean {
    return this.state === GameState.DEAD;
  }

  /**
   * ===== UI INITIALIZATION =====
   */
  private initializeUI() {
    // Crear textura de UI en pantalla completa
    this.uiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      'gameManagerUI',
      true,
      this.scene,
    );

    // Inicializar panels (ocultos por defecto)
    this.createStartPanel();
    this.createPausePanel();
    this.createDeadPanel();

    // Mostrar pantalla de inicio
    this.showStartScreen();
  }

  /**
   * ===== PANEL: INICIO =====
   */
  private createStartPanel() {
    // Grid principal que contiene overlay + contenido
    const root = new Grid();
    root.width = 1;
    root.height = 1;
    root.addColumnDefinition(1);
    root.addRowDefinition(1);

    // Overlay oscuro semitransparente
    const overlay = new Rectangle();
    overlay.background = 'rgba(0, 0, 0, 0.6)';
    // root.addControl(overlay, 0, 0);

    // Panel de contenido
    const contentPanel = new StackPanel();
    contentPanel.isVertical = true;
    contentPanel.adaptHeightToChildren = true;
    contentPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    contentPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    contentPanel.spacing = 30;

    // Botón START
    this.startButton = Button.CreateSimpleButton('startBtn', 'empiese');
    this.startButton.width = 0.3;
    this.startButton.height = '70px';
    this.startButton.background = '#be3c3c';
    this.startButton.color = 'white';
    this.startButton.fontSize = 32;
    this.startButton.fontWeight = 'bold';
    this.startButton.cornerRadius = 10;
    this.startButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;

    this.startButton.onPointerClickObservable.add(() => {
      this.startGame();
    });

    // contentPanel.addControl(this.startButton);
    contentPanel.addControl(this.titleText);
    root.addControl(contentPanel, 0, 0);

    this.startPanel = root;
    this.uiTexture!.addControl(this.startPanel);
  }

  /**
   * ===== PANEL: PAUSA =====
   */
  private createPausePanel() {
    // Grid principal que contiene overlay + contenido
    const root = new Grid();
    root.width = 1;
    root.height = 1;
    root.addColumnDefinition(1);
    root.addRowDefinition(1);
    root.isVisible = false;

    // Overlay oscuro semitransparente
    const overlay = new Rectangle();
    overlay.background = 'rgba(0, 0, 0, 0.6)';
    root.addControl(overlay, 0, 0);

    // Panel de contenido
    const contentPanel = new StackPanel();
    contentPanel.isVertical = true;
    contentPanel.adaptHeightToChildren = true;
    contentPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    contentPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    contentPanel.spacing = 25;

    // Título PAUSED
    const pauseText = new TextBlock();
    pauseText.text = '⏸ PAUSED';
    pauseText.color = 'white';
    pauseText.fontSize = 60;
    pauseText.fontFamily = 'Arial';
    pauseText.fontWeight = 'bold';
    pauseText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    pauseText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    pauseText.height = '80px';

    // Texto de instrucción
    const instructionText = new TextBlock();
    instructionText.text = 'Press ESC or P to resume';
    instructionText.color = '#ecf0f1';
    instructionText.fontSize = 18;
    instructionText.textHorizontalAlignment =
      Control.HORIZONTAL_ALIGNMENT_CENTER;
    instructionText.height = '30px';

    // Botón RESUME
    const resumeButton = Button.CreateSimpleButton('resumeBtn', 'RESUME');
    resumeButton.width = 0.35;
    resumeButton.height = '70px';
    resumeButton.background = '#27ae60';
    resumeButton.color = 'white';
    resumeButton.fontSize = 32;
    resumeButton.fontWeight = 'bold';
    resumeButton.cornerRadius = 10;
    resumeButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    resumeButton.onPointerClickObservable.add(() => {
      this.resumeGame();
    });

    contentPanel.addControl(pauseText);
    contentPanel.addControl(instructionText);
    contentPanel.addControl(resumeButton);
    root.addControl(contentPanel, 0, 0);

    this.pausePanel = root;
    this.uiTexture!.addControl(this.pausePanel);
  }

  /**
   * ===== PANEL: MUERTE =====
   */
  private createDeadPanel() {
    // Grid principal que contiene overlay + contenido
    const root = new Grid();
    root.width = 1;
    root.height = 1;
    root.addColumnDefinition(1);
    root.addRowDefinition(1);
    root.isVisible = false;

    // Overlay oscuro semitransparente
    const overlay = new Rectangle();
    overlay.background = 'rgba(0, 0, 0, 0.6)';
    root.addControl(overlay, 0, 0);

    // Panel de contenido
    const contentPanel = new StackPanel();
    contentPanel.isVertical = true;
    contentPanel.adaptHeightToChildren = true;
    contentPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    contentPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    contentPanel.spacing = 25;

    // Título DEAD
    const deadText = new TextBlock();
    deadText.text = '💀 PACO';
    deadText.color = '#e74c3c';
    deadText.fontSize = 60;
    deadText.fontFamily = 'Arial';
    deadText.fontWeight = 'bold';
    deadText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    deadText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    deadText.height = '80px';

    // Información de enemigos derrotados
    const statsText = new TextBlock();
    statsText.text = `Enemies Defeated: ${this.enemyDefeatedCount}`;
    statsText.color = 'white';
    statsText.fontSize = 24;
    statsText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    statsText.height = '40px';

    // Botón RESTART
    const restartButton = Button.CreateSimpleButton('restartBtn', 'RESTART');
    restartButton.width = 0.35;
    restartButton.height = '70px';
    restartButton.background = '#e74c3c';
    restartButton.color = 'white';
    restartButton.fontSize = 32;
    restartButton.fontWeight = 'bold';
    restartButton.cornerRadius = 10;
    restartButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    restartButton.onPointerClickObservable.add(() => {
      this.restartGame();
    });

    contentPanel.addControl(deadText);
    contentPanel.addControl(statsText);
    contentPanel.addControl(restartButton);
    root.addControl(contentPanel, 0, 0);

    this.deadPanel = root;
    this.uiTexture!.addControl(this.deadPanel);
  }

  /**
   * ===== STATE TRANSITIONS =====
   */

  /**
   * Transición: START -> PLAYING
   */
  public startGame() {
    console.log('[GameManager] Iniciando juego...');
    this.changeState(GameState.PLAYING);
    this.hideStartScreen();

    // Activar pointerlock
    if (this.engine && this.engine.enterPointerlock) {
      this.engine.enterPointerlock();
    }

    // Habilitar controles de cámara
    this.enableCameraInput();

    // Habilitar controles de PlayerController
    if (this.playerController) {
      this.playerController.enableInput();
    }

    // Activar AI de enemigos
    this.enableEnemies();
  }

  /**
   * Transición: PLAYING -> PAUSED
   */
  public pauseGame() {
    if (this.state !== GameState.PLAYING) {
      return; // Solo pausar desde PLAYING
    }

    console.log('[GameManager] Jugador pausó');
    this.changeState(GameState.PAUSED);
    this.showPauseScreen();

    // Detener controles de movimiento del jugador
    if (this.playerController && this.playerController.detachControl) {
      this.playerController.detachControl();
    }

    // Detener input de cámara
    this.disableCameraInput();

    // Pausar enemigos (detener animaciones y movimiento)
    this.disableEnemies();

    // Liberar ratón si pointerlock está activo
    this.releasePointerLock();
  }

  /**
   * Transición: PAUSED -> PLAYING
   */
  public resumeGame() {
    if (this.state !== GameState.PAUSED) {
      return;
    }

    console.log('[GameManager] Reanudando juego...');
    this.changeState(GameState.PLAYING);
    this.hidePauseScreen();

    // Re-activar input de cámara
    this.enableCameraInput();

    if (this.playerController && this.playerController.enableInput) {
      this.playerController.enableInput();
    }

    // Re-activar enemigos
    this.enableEnemies();

    // Re-activar pointerlock
    if (this.engine && this.engine.enterPointerlock) {
      this.engine.enterPointerlock();
    }
  }

  /**
   * Transición: PLAYING -> DEAD
   */
  public gameOver() {
    if (this.state === GameState.DEAD) {
      return; // Ya está muerto
    }

    console.log('[GameManager] GAME OVER');
    this.changeState(GameState.DEAD);
    this.showDeadScreen();

    // Detener todo
    if (this.playerController && this.playerController.detachControl) {
      this.playerController.detachControl();
    }

    this.disableEnemies();
    this.releasePointerLock();
  }

  /**
   * Reiniciar: DEAD -> START
   */
  public restartGame() {
    console.log('[GameManager] Reiniciando juego...');
    // Recargar la página (opción simple)
    location.reload();

    // Alternativamente, resetear estado interno:
    // this.changeState(GameState.START);
    // this.resetGame();
    // this.showStartScreen();
  }

  /**
   * ===== INTERNAL UI UPDATES =====
   */
  private showStartScreen() {
    if (this.startPanel) {
      this.startPanel.isVisible = true;
    }
  }

  private hideStartScreen() {
    if (this.startPanel) {
      this.startPanel.isVisible = false;
    }
  }

  private showPauseScreen() {
    if (this.pausePanel) {
      this.pausePanel.isVisible = true;
    }
  }

  private hidePauseScreen() {
    if (this.pausePanel) {
      this.pausePanel.isVisible = false;
    }
  }

  private showDeadScreen() {
    if (this.deadPanel) {
      // ocultar otros panels por si acaso
      if (this.startPanel) {
        this.startPanel.isVisible = false;
      }
      if (this.pausePanel) {
        this.pausePanel.isVisible = false;
      }
      this.deadPanel.isVisible = true;
    }
  }

  /**
   * ===== STATE MANAGEMENT =====
   */
  private changeState(newState: GameState) {
    if (this.state === newState) {
      return; // No cambiar si ya está en ese estado
    }

    console.log(`[GameManager] Estado: ${this.state} -> ${newState}`);
    this.state = newState;

    // Callback para lógica adicional
    if (this.onStateChange) {
      this.onStateChange(newState);
    }
  }

  /**
   * ===== ENEMY CONTROL =====
   */
  private enableEnemies() {
    for (const enemy of this.enemies) {
      if (enemy && enemy.enableUpdate) {
        enemy.enableUpdate();
      }
    }
  }

  private disableEnemies() {
    for (const enemy of this.enemies) {
      if (enemy && enemy.disableUpdate) {
        enemy.disableUpdate();
      }
    }
  }

  /**
   * ===== POINTER LOCK =====
   */
  private releasePointerLock() {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  /**
   * ===== CAMERA CONTROL =====
   */
  private enableCameraInput() {
    if (this.camera && this.camera.attachControl) {
      this.camera.attachControl();
    }
  }

  private disableCameraInput() {
    if (this.camera && this.camera.detachControl) {
      this.camera.detachControl();
    }
  }

  /**
   * ===== INPUT LISTENERS =====
   */
  private setupInputListeners() {
    document.addEventListener('keydown', (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      // Escape o P para pausar/reanudar
      if (key === 'escape' || key === 'p') {
        event.preventDefault();

        if (this.state === GameState.PLAYING) {
          this.pauseGame();
        } else if (this.state === GameState.PAUSED) {
          this.resumeGame();
        }
      }
    });
  }

  /**
   * ===== EXTENSIÓN: CONTADOR DE ENEMIGOS =====
   * Implementar cuando el WeaponSystem / HitboxSystem registre kills
   */
  public onEnemyDefeated() {
    this.enemyDefeatedCount++;
    console.log(
      `[GameManager] Enemigos derrotados: ${this.enemyDefeatedCount}`,
    );
  }

  public getEnemyDefeatedCount(): number {
    return this.enemyDefeatedCount;
  }

  public resetEnemyDefeatedCount() {
    this.enemyDefeatedCount = 0;
  }
}
