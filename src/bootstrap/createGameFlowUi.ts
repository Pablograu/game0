import {
  AdvancedDynamicTexture,
  Button,
  Control,
  Grid,
  Rectangle,
  StackPanel,
  TextBlock,
} from '@babylonjs/gui';
import type { Scene } from '@babylonjs/core';
import type { GameFlowControllerApi } from '../ecs/game/index.ts';

export interface GameFlowUiRuntime {
  dispose(): void;
  uiTexture: AdvancedDynamicTexture;
}

export function createGameFlowUi(
  scene: Scene,
  gameFlow: GameFlowControllerApi | null,
): GameFlowUiRuntime {
  const uiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
    'gameFlowUI',
    true,
    scene,
  );

  const titleText = createCenteredText('La Bengansa', 72, '#f4f1de');
  const deadStatsText = createCenteredText('Enemies Defeated: 0', 24, 'white');

  const startButton = Button.CreateSimpleButton('startBtn', 'EMPIESE');
  stylePrimaryButton(startButton, '#be3c3c');
  startButton.onPointerClickObservable.add(() => {
    gameFlow?.requestStartFromGesture();
  });

  const resumeButton = Button.CreateSimpleButton('resumeBtn', 'RESUME');
  stylePrimaryButton(resumeButton, '#27ae60');
  resumeButton.onPointerClickObservable.add(() => {
    gameFlow?.requestResumeFromGesture();
  });

  const restartButton = Button.CreateSimpleButton('restartBtn', 'RESTART');
  stylePrimaryButton(restartButton, '#e74c3c');
  restartButton.onPointerClickObservable.add(() => {
    gameFlow?.requestRestart();
  });

  const startPanel = createOverlayPanel([titleText, startButton]);
  const pausePanel = createOverlayPanel([
    createCenteredText('PAUSED', 60, 'white'),
    createCenteredText('Press ESC or P to resume', 18, '#ecf0f1'),
    resumeButton,
  ]);
  pausePanel.isVisible = false;

  const deadPanel = createOverlayPanel([
    createCenteredText('YOU DIED', 60, '#e74c3c'),
    deadStatsText,
    restartButton,
  ]);
  deadPanel.isVisible = false;

  uiTexture.addControl(startPanel);
  uiTexture.addControl(pausePanel);
  uiTexture.addControl(deadPanel);

  gameFlow?.attachUiRefs({
    uiTexture,
    startPanel,
    pausePanel,
    deadPanel,
    titleText,
    startButton,
    deadStatsText,
  });

  const onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();

    if (key !== 'escape' && key !== 'p') {
      return;
    }

    event.preventDefault();
    gameFlow?.requestTogglePauseFromGesture();
  };

  document.addEventListener('keydown', onKeyDown);

  return {
    uiTexture,
    dispose() {
      document.removeEventListener('keydown', onKeyDown);
      uiTexture.dispose();
    },
  };
}

function createOverlayPanel(controls: Control[]) {
  const root = new Grid();
  root.width = 1;
  root.height = 1;
  root.addColumnDefinition(1);
  root.addRowDefinition(1);

  const overlay = new Rectangle();
  overlay.background = 'rgba(0, 0, 0, 0.6)';
  root.addControl(overlay, 0, 0);

  const contentPanel = new StackPanel();
  contentPanel.isVertical = true;
  contentPanel.adaptHeightToChildren = true;
  contentPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  contentPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  contentPanel.spacing = 25;

  controls.forEach((control) => contentPanel.addControl(control));
  root.addControl(contentPanel, 0, 0);

  return root;
}

function createCenteredText(text: string, fontSize: number, color: string) {
  const control = new TextBlock();
  control.text = text;
  control.color = color;
  control.fontSize = fontSize;
  control.fontFamily = 'Arial';
  control.fontWeight = 'bold';
  control.height = `${Math.max(40, fontSize + 20)}px`;
  control.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  control.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  return control;
}

function stylePrimaryButton(button: Button, background: string) {
  button.width = 0.35;
  button.height = '70px';
  button.background = background;
  button.color = 'white';
  button.fontSize = 32;
  button.fontWeight = 'bold';
  button.cornerRadius = 10;
  button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
}
