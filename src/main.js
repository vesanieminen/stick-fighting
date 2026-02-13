import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { CharacterSelectScene } from './scenes/CharacterSelectScene.js';
import { MapSelectScene } from './scenes/MapSelectScene.js';
import { FightScene } from './scenes/FightScene.js';
import { ResultScene } from './scenes/ResultScene.js';

const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 1200 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  input: {
    gamepad: true
  },
  scene: [BootScene, TitleScene, CharacterSelectScene, MapSelectScene, FightScene, ResultScene]
};

new Phaser.Game(config);
