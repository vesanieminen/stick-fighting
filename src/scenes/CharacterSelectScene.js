import Phaser from 'phaser';
import { FIGHTERS } from '../fighters/FighterData.js';
import { StickFigureRenderer } from '../fighters/StickFigureRenderer.js';
import { POSES } from '../fighters/FighterAnimations.js';
import { SoundManager } from '../audio/SoundManager.js';

const COLS = 5;
const ROWS = 2;
const CELL_W = 200;
const CELL_H = 180;
const GRID_X = 140; // left edge of grid
const GRID_Y = 120; // top edge of grid

export class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super('CharacterSelectScene');
  }

  create() {
    this.p1Index = 0;
    this.p2Index = 1;
    this.p1Locked = false;
    this.p2Locked = false;

    // Title
    this.add.text(640, 40, 'SELECT YOUR FIGHTER', {
      fontSize: '36px', fontFamily: 'monospace', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(640, 80, 'P1: WASD + J to lock    P2: Arrows + , to lock', {
      fontSize: '14px', fontFamily: 'monospace', color: '#666666'
    }).setOrigin(0.5);

    // Draw character grid
    this.cellGraphics = [];
    this.cellTexts = [];
    for (let i = 0; i < FIGHTERS.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = GRID_X + col * CELL_W + CELL_W / 2;
      const cy = GRID_Y + row * CELL_H + CELL_H / 2;

      const fighter = FIGHTERS[i];

      // Cell background
      const g = this.add.graphics();
      this.cellGraphics.push(g);

      // Character name
      const nameText = this.add.text(cx, cy + 50, fighter.name, {
        fontSize: '14px', fontFamily: 'monospace', color: '#aaaaaa'
      }).setOrigin(0.5);
      this.cellTexts.push(nameText);

      // Stick figure preview
      const figG = this.add.graphics();
      const renderer = new StickFigureRenderer(figG);
      renderer.draw(cx, cy + 20, POSES.IDLE[0], true, fighter.color);
    }

    // Info panel at the bottom
    this.p1Info = this.add.text(200, 520, '', {
      fontSize: '16px', fontFamily: 'monospace', color: '#ffffff', wordWrap: { width: 350 }
    }).setOrigin(0.5, 0);

    this.p2Info = this.add.text(1080, 520, '', {
      fontSize: '16px', fontFamily: 'monospace', color: '#ffffff', wordWrap: { width: 350 }
    }).setOrigin(0.5, 0);

    // P1/P2 labels
    this.add.text(200, 495, 'PLAYER 1', {
      fontSize: '20px', fontFamily: 'monospace', color: '#ffcc00', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(1080, 495, 'PLAYER 2', {
      fontSize: '20px', fontFamily: 'monospace', color: '#ffcc00', fontStyle: 'bold'
    }).setOrigin(0.5);

    // Lock status texts
    this.p1LockText = this.add.text(200, 660, '', {
      fontSize: '18px', fontFamily: 'monospace', color: '#00ff00'
    }).setOrigin(0.5);

    this.p2LockText = this.add.text(1080, 660, '', {
      fontSize: '18px', fontFamily: 'monospace', color: '#00ff00'
    }).setOrigin(0.5);

    // Start prompt
    this.startText = this.add.text(640, 690, '', {
      fontSize: '20px', fontFamily: 'monospace', color: '#ffcc00'
    }).setOrigin(0.5);

    // Selection highlight graphics
    this.highlightGraphics = this.add.graphics();
    this.highlightGraphics.setDepth(50);

    // Keyboard input
    this.p1Keys = {
      up: this.input.keyboard.addKey('W'),
      down: this.input.keyboard.addKey('S'),
      left: this.input.keyboard.addKey('A'),
      right: this.input.keyboard.addKey('D'),
      confirm: this.input.keyboard.addKey('J'),
      cancel: this.input.keyboard.addKey('K'),
    };

    this.p2Keys = {
      up: this.input.keyboard.addKey('UP'),
      down: this.input.keyboard.addKey('DOWN'),
      left: this.input.keyboard.addKey('LEFT'),
      right: this.input.keyboard.addKey('RIGHT'),
      confirm: this.input.keyboard.addKey('COMMA'),
      cancel: this.input.keyboard.addKey('PERIOD'),
    };

    // Gamepad tracking
    this.p1Pad = null;
    this.p2Pad = null;
    this.p1PadPrev = {};
    this.p2PadPrev = {};

    if (this.input.gamepad) {
      this.input.gamepad.on('connected', (pad) => {
        if (pad.index === 0 && !this.p1Pad) this.p1Pad = pad;
        if (pad.index === 1 && !this.p2Pad) this.p2Pad = pad;
      });
      if (this.input.gamepad.pad1) this.p1Pad = this.input.gamepad.pad1;
      if (this.input.gamepad.pad2) this.p2Pad = this.input.gamepad.pad2;
    }

    this.updateDisplay();
  }

  update() {
    // P1 navigation
    if (!this.p1Locked) {
      if (Phaser.Input.Keyboard.JustDown(this.p1Keys.left) || this.padJustPressed(1, 'left')) {
        this.moveSelection(1, -1, 0);
      }
      if (Phaser.Input.Keyboard.JustDown(this.p1Keys.right) || this.padJustPressed(1, 'right')) {
        this.moveSelection(1, 1, 0);
      }
      if (Phaser.Input.Keyboard.JustDown(this.p1Keys.up) || this.padJustPressed(1, 'up')) {
        this.moveSelection(1, 0, -1);
      }
      if (Phaser.Input.Keyboard.JustDown(this.p1Keys.down) || this.padJustPressed(1, 'down')) {
        this.moveSelection(1, 0, 1);
      }
      if (Phaser.Input.Keyboard.JustDown(this.p1Keys.confirm) || this.padJustPressed(1, 'A')) {
        this.lockIn(1);
      }
    } else if (Phaser.Input.Keyboard.JustDown(this.p1Keys.cancel) || this.padJustPressed(1, 'B')) {
      this.unlock(1);
    }

    // P2 navigation
    if (!this.p2Locked) {
      if (Phaser.Input.Keyboard.JustDown(this.p2Keys.left) || this.padJustPressed(2, 'left')) {
        this.moveSelection(2, -1, 0);
      }
      if (Phaser.Input.Keyboard.JustDown(this.p2Keys.right) || this.padJustPressed(2, 'right')) {
        this.moveSelection(2, 1, 0);
      }
      if (Phaser.Input.Keyboard.JustDown(this.p2Keys.up) || this.padJustPressed(2, 'up')) {
        this.moveSelection(2, 0, -1);
      }
      if (Phaser.Input.Keyboard.JustDown(this.p2Keys.down) || this.padJustPressed(2, 'down')) {
        this.moveSelection(2, 0, 1);
      }
      if (Phaser.Input.Keyboard.JustDown(this.p2Keys.confirm) || this.padJustPressed(2, 'A')) {
        this.lockIn(2);
      }
    } else if (Phaser.Input.Keyboard.JustDown(this.p2Keys.cancel) || this.padJustPressed(2, 'B')) {
      this.unlock(2);
    }

    this.updatePadPrev();
  }

  padJustPressed(player, button) {
    const pad = player === 1 ? this.p1Pad : this.p2Pad;
    const prev = player === 1 ? this.p1PadPrev : this.p2PadPrev;
    if (!pad || !pad.connected) return false;

    let current = false;
    switch (button) {
      case 'left': current = pad.left; break;
      case 'right': current = pad.right; break;
      case 'up': current = pad.up; break;
      case 'down': current = pad.down; break;
      case 'A': current = pad.A; break;
      case 'B': current = pad.B; break;
    }
    return current && !prev[button];
  }

  updatePadPrev() {
    for (const [pad, prev] of [[this.p1Pad, this.p1PadPrev], [this.p2Pad, this.p2PadPrev]]) {
      if (!pad || !pad.connected) continue;
      prev.left = pad.left;
      prev.right = pad.right;
      prev.up = pad.up;
      prev.down = pad.down;
      prev.A = pad.A;
      prev.B = pad.B;
    }
  }

  moveSelection(player, dx, dy) {
    const idx = player === 1 ? this.p1Index : this.p2Index;
    let col = idx % COLS;
    let row = Math.floor(idx / COLS);

    col += dx;
    row += dy;

    // Wrap
    if (col < 0) col = COLS - 1;
    if (col >= COLS) col = 0;
    if (row < 0) row = ROWS - 1;
    if (row >= ROWS) row = 0;

    const newIdx = row * COLS + col;
    if (newIdx >= 0 && newIdx < FIGHTERS.length) {
      if (player === 1) this.p1Index = newIdx;
      else this.p2Index = newIdx;
      SoundManager.menuSelect();
      this.updateDisplay();
    }
  }

  lockIn(player) {
    if (player === 1) this.p1Locked = true;
    else this.p2Locked = true;

    SoundManager.roundStart();
    this.updateDisplay();

    if (this.p1Locked && this.p2Locked) {
      this.time.delayedCall(500, () => this.startFight());
    }
  }

  unlock(player) {
    if (player === 1) this.p1Locked = false;
    else this.p2Locked = false;
    SoundManager.block();
    this.updateDisplay();
  }

  updateDisplay() {
    const hg = this.highlightGraphics;
    hg.clear();

    // Draw cell backgrounds and highlights
    for (let i = 0; i < FIGHTERS.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = GRID_X + col * CELL_W;
      const y = GRID_Y + row * CELL_H;

      const g = this.cellGraphics[i];
      g.clear();

      // Base cell background
      g.fillStyle(0x1a1a3e, 0.6);
      g.fillRect(x + 4, y + 4, CELL_W - 8, CELL_H - 8);
      g.lineStyle(1, 0x333366, 0.8);
      g.strokeRect(x + 4, y + 4, CELL_W - 8, CELL_H - 8);
    }

    // P1 highlight (yellow border)
    const p1col = this.p1Index % COLS;
    const p1row = Math.floor(this.p1Index / COLS);
    const p1x = GRID_X + p1col * CELL_W;
    const p1y = GRID_Y + p1row * CELL_H;
    hg.lineStyle(3, this.p1Locked ? 0x00ff00 : 0xffcc00, 1);
    hg.strokeRect(p1x + 2, p1y + 2, CELL_W - 4, CELL_H - 4);

    // P1 marker
    hg.fillStyle(this.p1Locked ? 0x00ff00 : 0xffcc00, 1);
    hg.fillTriangle(p1x + 10, p1y + 8, p1x + 22, p1y + 8, p1x + 16, p1y + 18);
    hg.fillStyle(0x000000, 1);
    // "1" label
    const p1Label = this.add.text ? null : null; // handled below

    // P2 highlight (cyan border)
    const p2col = this.p2Index % COLS;
    const p2row = Math.floor(this.p2Index / COLS);
    const p2x = GRID_X + p2col * CELL_W;
    const p2y = GRID_Y + p2row * CELL_H;
    hg.lineStyle(3, this.p2Locked ? 0x00ff00 : 0x00ccff, 1);
    hg.strokeRect(p2x + 6, p2y + 6, CELL_W - 12, CELL_H - 12);

    // P2 marker
    hg.fillStyle(this.p2Locked ? 0x00ff00 : 0x00ccff, 1);
    hg.fillTriangle(p2x + CELL_W - 10, p2y + 8, p2x + CELL_W - 22, p2y + 8, p2x + CELL_W - 16, p2y + 18);

    // Info panels
    const p1f = FIGHTERS[this.p1Index];
    const p2f = FIGHTERS[this.p2Index];

    this.p1Info.setText(
      `${p1f.name}\n` +
      `${p1f.description}\n\n` +
      `SPD: ${'|'.repeat(Math.round(p1f.moveSpeed / 40))}  ` +
      `HP: ${p1f.maxHealth || 100}\n` +
      `Special: ${p1f.specialName}`
    );
    this.p1Info.setColor(`#${p1f.color.toString(16).padStart(6, '0')}`);

    this.p2Info.setText(
      `${p2f.name}\n` +
      `${p2f.description}\n\n` +
      `SPD: ${'|'.repeat(Math.round(p2f.moveSpeed / 40))}  ` +
      `HP: ${p2f.maxHealth || 100}\n` +
      `Special: ${p2f.specialName}`
    );
    this.p2Info.setColor(`#${p2f.color.toString(16).padStart(6, '0')}`);

    // Lock status
    this.p1LockText.setText(this.p1Locked ? 'LOCKED IN!' : '');
    this.p2LockText.setText(this.p2Locked ? 'LOCKED IN!' : '');

    // Start text
    if (this.p1Locked && this.p2Locked) {
      this.startText.setText('GET READY...');
    } else {
      this.startText.setText('');
    }
  }

  startFight() {
    this.registry.set('p1Fighter', this.p1Index);
    this.registry.set('p2Fighter', this.p2Index);
    this.registry.set('p1Wins', 0);
    this.registry.set('p2Wins', 0);
    this.registry.set('currentRound', 1);
    this.scene.start('FightScene');
  }
}
