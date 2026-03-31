import { createComponentType } from '../../core/Component.ts';

export interface EnemyIdentityComponent {
  kind: 'enemy';
  modelPath: string;
  debugLabel: string;
}

export const EnemyIdentityComponent =
  createComponentType<EnemyIdentityComponent>('EnemyIdentityComponent');
