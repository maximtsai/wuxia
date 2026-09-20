import Phaser from 'phaser';
import { SliceScene } from './scenes/SliceScene';
import { RigPreviewScene } from './characters/RigPreviewScene';

export const LOGICAL_WIDTH = 1600;
export const LOGICAL_HEIGHT = 900;

export function createGame(): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: LOGICAL_WIDTH,
    height: LOGICAL_HEIGHT,
    backgroundColor: '#000000',
    scene: [
      new URLSearchParams(location.search).has('rigPreview')
        ? RigPreviewScene
        : SliceScene,
    ],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
    },
  });
}
