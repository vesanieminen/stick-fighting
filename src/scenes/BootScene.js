import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    this.registry.set('p1Wins', 0);
    this.registry.set('p2Wins', 0);
    this.registry.set('currentRound', 1);
    this.scene.start('TitleScene');
  }
}
