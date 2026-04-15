import type { TransformNode } from '@babylonjs/core';
import {
  AdvancedDynamicTexture,
  Control,
  Rectangle,
  StackPanel,
  TextBlock,
} from '@babylonjs/gui';

const VIEW_WIDTH = 144;
const NAME_HEIGHT = 20;
const BAR_WIDTH = 112;
const BAR_HEIGHT = 10;

export class EnemyUiView {
  private readonly root: StackPanel;
  private readonly nameLabel: TextBlock;
  private readonly healthFill: Rectangle;
  private attached = false;

  constructor() {
    const root = new StackPanel();
    root.name = 'enemy-ui-root';
    root.isVertical = true;
    root.adaptHeightToChildren = true;
    root.widthInPixels = VIEW_WIDTH;
    root.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    root.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    root.isPointerBlocker = false;
    root.alpha = 0;
    root.isVisible = false;
    root.spacing = 4;
    this.root = root;

    const nameLabel = new TextBlock('enemy-ui-name');
    nameLabel.heightInPixels = NAME_HEIGHT;
    nameLabel.color = '#f3ead7';
    nameLabel.fontFamily = 'Arial';
    nameLabel.fontSizeInPixels = 14;
    nameLabel.fontWeight = 'bold';
    nameLabel.outlineColor = 'rgba(0, 0, 0, 0.85)';
    nameLabel.outlineWidth = 3;
    nameLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    nameLabel.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    nameLabel.isPointerBlocker = false;
    this.nameLabel = nameLabel;

    const healthTrack = new Rectangle('enemy-ui-health-track');
    healthTrack.widthInPixels = BAR_WIDTH;
    healthTrack.heightInPixels = BAR_HEIGHT;
    healthTrack.thickness = 1;
    healthTrack.color = 'rgba(0, 0, 0, 0.9)';
    healthTrack.background = 'rgba(25, 15, 15, 0.72)';
    healthTrack.cornerRadius = 5;
    healthTrack.isPointerBlocker = false;

    const healthFill = new Rectangle('enemy-ui-health-fill');
    healthFill.widthInPixels = BAR_WIDTH;
    healthFill.heightInPixels = BAR_HEIGHT;
    healthFill.thickness = 0;
    healthFill.background = '#d04848';
    healthFill.cornerRadius = 5;
    healthFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    healthFill.isPointerBlocker = false;
    this.healthFill = healthFill;

    healthTrack.addControl(healthFill);
    root.addControl(nameLabel);
    root.addControl(healthTrack);
  }

  attach(
    texture: AdvancedDynamicTexture,
    mesh: TransformNode,
    linkOffsetY: number,
  ): void {
    if (!this.attached) {
      texture.addControl(this.root);
      this.attached = true;
    }

    this.root.linkWithMesh(mesh);
    this.root.linkOffsetY = linkOffsetY;
  }

  detach(texture: AdvancedDynamicTexture): void {
    this.root.linkWithMesh(null);

    if (!this.attached) {
      return;
    }

    texture.removeControl(this.root);
    this.attached = false;
  }

  setName(name: string): void {
    this.nameLabel.text = name;
  }

  setHealthRatio(ratio: number): void {
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    this.healthFill.widthInPixels = BAR_WIDTH * clampedRatio;
  }

  setAlpha(alpha: number): void {
    this.root.alpha = Math.max(0, Math.min(1, alpha));
  }

  setScale(scale: number): void {
    this.root.scaleX = scale;
    this.root.scaleY = scale;
  }

  setVisible(isVisible: boolean): void {
    this.root.isVisible = isVisible;
  }

  setLinkOffsetY(linkOffsetY: number): void {
    this.root.linkOffsetY = linkOffsetY;
  }

  reset(): void {
    this.setName('');
    this.setHealthRatio(1);
    this.setAlpha(0);
    this.setScale(1);
    this.setVisible(false);
    this.root.linkOffsetY = 0;
    this.root.linkWithMesh(null);
  }

  dispose(): void {
    this.root.dispose();
  }
}
