import Phaser from 'phaser';
import { StickFigureRenderer } from '../fighters/StickFigureRenderer.js';
import { POSES } from '../fighters/FighterAnimations.js';
import { SoundManager } from '../audio/SoundManager.js';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    // Title text
    this.add.text(640, 160, 'STICK FIGHTER', {
      fontSize: '72px',
      fontFamily: 'monospace',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(640, 240, 'A game of sticks and honor', {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#888888'
    }).setOrigin(0.5);

    // Draw two idle stick figures as decoration
    const g1 = this.add.graphics();
    const renderer1 = new StickFigureRenderer(g1);
    renderer1.draw(440, 480, POSES.IDLE[0], true, 0xffffff);

    const g2 = this.add.graphics();
    const renderer2 = new StickFigureRenderer(g2);
    renderer2.draw(840, 480, POSES.IDLE[0], false, 0x00ffff);

    // Controls info
    this.add.text(640, 560, 'P1: WASD + J/K/L    P2: Arrows + , . /', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#666666'
    }).setOrigin(0.5);

    this.add.text(640, 585, 'Gamepads supported!', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#555555'
    }).setOrigin(0.5);

    // Blinking "Press Enter" prompt
    this.promptText = this.add.text(640, 650, 'Press ENTER or SPACE to fight!', {
      fontSize: '24px',
      fontFamily: 'monospace',
      color: '#ffcc00'
    }).setOrigin(0.5);

    this.tweens.add({
      targets: this.promptText,
      alpha: 0.3,
      duration: 600,
      yoyo: true,
      repeat: -1
    });

    // Input listeners
    this.input.keyboard.on('keydown-ENTER', this.startGame, this);
    this.input.keyboard.on('keydown-SPACE', this.startGame, this);

    // Gamepad start
    this.input.gamepad.on('down', (pad, button) => {
      this.startGame();
    });
  }

  startGame() {
    SoundManager.menuSelect();
    this.scene.start('CharacterSelectScene');
  }
}
