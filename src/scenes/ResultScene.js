import Phaser from 'phaser';
import { StickFigureRenderer } from '../fighters/StickFigureRenderer.js';
import { POSES } from '../fighters/FighterAnimations.js';
import { FIGHTERS } from '../fighters/FighterData.js';
import { SoundManager } from '../audio/SoundManager.js';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  create() {
    const winner = this.registry.get('matchWinner');
    const p1Wins = this.registry.get('p1Wins');
    const p2Wins = this.registry.get('p2Wins');

    const p1Idx = this.registry.get('p1Fighter') || 0;
    const p2Idx = this.registry.get('p2Fighter') || 1;
    const winnerData = winner === 0 ? FIGHTERS[p1Idx] : FIGHTERS[p2Idx];
    const loserData = winner === 0 ? FIGHTERS[p2Idx] : FIGHTERS[p1Idx];

    SoundManager.victory();
    const playerCount = this.registry.get('playerCount') || 2;
    const p2Label = playerCount === 1 ? 'CPU' : 'PLAYER 2';
    const winnerName = winner === 0 ? 'PLAYER 1' : p2Label;

    // Winner announcement
    this.add.text(640, 120, `${winnerName} WINS!`, {
      fontSize: '64px',
      fontFamily: 'monospace',
      color: '#ffcc00',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Character name
    this.add.text(640, 190, winnerData.name, {
      fontSize: '28px',
      fontFamily: 'monospace',
      color: winner === 0 ? '#ffffff' : '#00ffff'
    }).setOrigin(0.5);

    // Score
    this.add.text(640, 250, `${p1Wins} - ${p2Wins}`, {
      fontSize: '48px',
      fontFamily: 'monospace',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Winner in victory pose
    const winnerGraphics = this.add.graphics();
    const winnerRenderer = new StickFigureRenderer(winnerGraphics);
    winnerRenderer.draw(640, 460, POSES.VICTORY[0], true, winnerData.color, false, winnerData.visual || null);

    // Loser in KO pose (on the side)
    const loserGraphics = this.add.graphics();
    const loserRenderer = new StickFigureRenderer(loserGraphics);
    const loserPose = POSES.KO[POSES.KO.length - 1];
    const loserX = winner === 0 ? 900 : 380;
    loserRenderer.draw(loserX, 480, loserPose, winner !== 0, loserData.color, false, loserData.visual || null);

    // Play again prompt
    const prompt = this.add.text(640, 620, 'Press ENTER or SPACE to play again', {
      fontSize: '22px',
      fontFamily: 'monospace',
      color: '#ffcc00'
    }).setOrigin(0.5);

    this.tweens.add({
      targets: prompt,
      alpha: 0.3,
      duration: 600,
      yoyo: true,
      repeat: -1
    });

    // Input
    this.input.keyboard.on('keydown-ENTER', this.restart, this);
    this.input.keyboard.on('keydown-SPACE', this.restart, this);
    this.input.gamepad.on('down', () => this.restart());
  }

  restart() {
    SoundManager.menuSelect();
    this.scene.start('CharacterSelectScene');
  }
}
