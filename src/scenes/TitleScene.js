import Phaser from 'phaser';
import { StickFigureRenderer } from '../fighters/StickFigureRenderer.js';
import { POSES } from '../fighters/FighterAnimations.js';
import { SoundManager } from '../audio/SoundManager.js';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    this.p1Joined = false;
    this.p2Joined = false;

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

    // P1 stick figure (always white)
    const g1 = this.add.graphics();
    const renderer1 = new StickFigureRenderer(g1);
    renderer1.draw(440, 480, POSES.IDLE[0], true, 0xffffff);

    // P2 stick figure — drawn dynamically based on join state
    this.p2FigureGraphics = this.add.graphics();
    this.p2Renderer = new StickFigureRenderer(this.p2FigureGraphics);
    this.drawP2Figure();

    // CPU label for P2 (shown when not joined)
    this.cpuLabel = this.add.text(840, 540, 'CPU', {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#666666'
    }).setOrigin(0.5);

    // Join status texts
    this.p1JoinText = this.add.text(440, 540, 'Press J to join', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#888888'
    }).setOrigin(0.5);

    this.p2JoinText = this.add.text(840, 540, 'Press , to join', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#888888'
    }).setOrigin(0.5);

    // Controls info
    this.add.text(640, 585, 'Gamepads supported!', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#555555'
    }).setOrigin(0.5);

    // Start prompt (hidden until P1 joins)
    this.promptText = this.add.text(640, 650, '', {
      fontSize: '24px',
      fontFamily: 'monospace',
      color: '#ffcc00'
    }).setOrigin(0.5);

    this.promptTween = null;

    // Keyboard input
    this.input.keyboard.on('keydown-J', () => this.joinPlayer(1));
    this.input.keyboard.on('keydown-COMMA', () => this.joinPlayer(2));
    this.input.keyboard.on('keydown-ENTER', () => this.handleStart(1));
    this.input.keyboard.on('keydown-SPACE', () => this.handleStart(1));

    // Gamepad input
    this.p1PadPrevA = false;
    this.p2PadPrevA = false;
  }

  update() {
    // Gamepad join/start via A button
    if (this.input.gamepad) {
      const pads = this.input.gamepad.gamepads.filter(p => p && p.connected);

      for (const pad of pads) {
        const aDown = pad.A;
        if (pad.index === 0) {
          if (aDown && !this.p1PadPrevA) {
            if (!this.p1Joined) this.joinPlayer(1);
            else this.startGame();
          }
          this.p1PadPrevA = aDown;
        } else if (pad.index === 1) {
          if (aDown && !this.p2PadPrevA) {
            this.joinPlayer(2);
          }
          this.p2PadPrevA = aDown;
        }
      }
    }
  }

  joinPlayer(player) {
    if (player === 1 && !this.p1Joined) {
      this.p1Joined = true;
      this.p1JoinText.setText('P1 JOINED');
      this.p1JoinText.setColor('#00ff00');
      SoundManager.menuSelect();
      this.updatePrompt();
    } else if (player === 2 && !this.p2Joined) {
      this.p2Joined = true;
      this.p2JoinText.setText('P2 JOINED');
      this.p2JoinText.setColor('#00ff00');
      this.cpuLabel.setVisible(false);
      this.drawP2Figure();
      SoundManager.menuSelect();
      this.updatePrompt();
    }
  }

  handleStart(player) {
    // ENTER/SPACE: join P1 if not joined, then start if possible
    if (!this.p1Joined) {
      this.joinPlayer(1);
      // If P2 is also not joined, don't start yet — just join
      return;
    }
    this.startGame();
  }

  updatePrompt() {
    if (this.p1Joined) {
      this.promptText.setText('Press ENTER or SPACE to start!');
      if (!this.promptTween) {
        this.promptTween = this.tweens.add({
          targets: this.promptText,
          alpha: 0.3,
          duration: 600,
          yoyo: true,
          repeat: -1
        });
      }
    }
  }

  drawP2Figure() {
    this.p2FigureGraphics.clear();
    const color = this.p2Joined ? 0x00ffff : 0x555555;
    this.p2Renderer.draw(840, 480, POSES.IDLE[0], false, color);
  }

  startGame() {
    if (!this.p1Joined) return;
    const playerCount = this.p2Joined ? 2 : 1;
    this.registry.set('playerCount', playerCount);
    SoundManager.menuSelect();
    this.scene.start('CharacterSelectScene');
  }
}
