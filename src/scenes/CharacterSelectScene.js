import Phaser from 'phaser';
import { FIGHTERS } from '../fighters/FighterData.js';
import { StickFigureRenderer } from '../fighters/StickFigureRenderer.js';
import { POSES } from '../fighters/FighterAnimations.js';
import { SoundManager } from '../audio/SoundManager.js';

const COLS = 5;
const ROWS = 2;
const CELL_W = 200;
const CELL_H = 190;
const GRID_X = 140; // left edge of grid
const GRID_Y = 105; // top edge of grid

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
      const nameText = this.add.text(cx, cy + CELL_H / 2 - 18, fighter.name, {
        fontSize: '14px', fontFamily: 'monospace', color: '#aaaaaa'
      }).setOrigin(0.5);
      this.cellTexts.push(nameText);

      // Stick figure preview in SPECIAL pose (frame 2 = peak)
      const figG = this.add.graphics();
      const renderer = new StickFigureRenderer(figG);
      const scale = 0.7;
      const specialPose = POSES.SPECIAL[2]; // Peak frame
      const scaledPose = {};
      for (const joint in specialPose) {
        scaledPose[joint] = {
          x: specialPose[joint].x * scale,
          y: specialPose[joint].y * scale,
        };
      }
      renderer.draw(cx, cy + 10, scaledPose, true, fighter.color);

      // Special effect decoration behind the figure
      const fx = this.add.graphics();
      fx.setDepth(5);
      figG.setDepth(6);
      this.drawSpecialDecoration(fx, cx, cy + 10, fighter.specialType, fighter.color);
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

    // Gamepad tracking — look up pads dynamically each frame
    this.p1PadPrev = {};
    this.p2PadPrev = {};

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

  getPad(player) {
    if (!this.input.gamepad) return null;
    // Look up pad dynamically each frame — handles hot-plug and browser activation
    const pads = this.input.gamepad.gamepads.filter(p => p && p.connected);
    const idx = player - 1; // player 1 → pad index 0, player 2 → pad index 1
    return pads.find(p => p.index === idx) || null;
  }

  padJustPressed(player, button) {
    const pad = this.getPad(player);
    const prev = player === 1 ? this.p1PadPrev : this.p2PadPrev;
    if (!pad) return false;

    const DEADZONE = 0.5;
    const stickX = pad.leftStick ? pad.leftStick.x : 0;
    const stickY = pad.leftStick ? pad.leftStick.y : 0;

    let current = false;
    switch (button) {
      case 'left': current = pad.left || stickX < -DEADZONE; break;
      case 'right': current = pad.right || stickX > DEADZONE; break;
      case 'up': current = pad.up || stickY < -DEADZONE; break;
      case 'down': current = pad.down || stickY > DEADZONE; break;
      case 'A': current = pad.A; break;
      case 'B': current = pad.B; break;
    }
    return current && !prev[button];
  }

  updatePadPrev() {
    for (const player of [1, 2]) {
      const pad = this.getPad(player);
      const prev = player === 1 ? this.p1PadPrev : this.p2PadPrev;
      if (!pad) continue;

      const DEADZONE = 0.5;
      const stickX = pad.leftStick ? pad.leftStick.x : 0;
      const stickY = pad.leftStick ? pad.leftStick.y : 0;

      prev.left = pad.left || stickX < -DEADZONE;
      prev.right = pad.right || stickX > DEADZONE;
      prev.up = pad.up || stickY < -DEADZONE;
      prev.down = pad.down || stickY > DEADZONE;
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

  drawSpecialDecoration(g, x, y, specialType, color) {
    const alpha = 0.3;

    switch (specialType) {
      case 'lunge':
        // Speed lines behind
        for (let i = 0; i < 5; i++) {
          const ly = y - 40 + i * 20;
          g.lineStyle(2, color, alpha * (0.5 + Math.random() * 0.5));
          g.lineBetween(x - 50 - Math.random() * 20, ly, x - 20, ly);
        }
        break;

      case 'groundPound':
        // Shockwave arcs on ground
        g.lineStyle(2, color, alpha);
        g.beginPath();
        g.arc(x, y + 42, 35, Math.PI * 0.8, Math.PI * 0.2, true);
        g.strokePath();
        g.lineStyle(1.5, color, alpha * 0.6);
        g.beginPath();
        g.arc(x, y + 42, 50, Math.PI * 0.85, Math.PI * 0.15, true);
        g.strokePath();
        break;

      case 'teleport':
        // Ghostly afterimage offset
        g.lineStyle(2, color, 0.15);
        g.strokeCircle(x - 25, y - 20, 8);
        g.lineBetween(x - 25, y - 12, x - 25, y + 15);
        // Sparkle dots
        for (let i = 0; i < 6; i++) {
          const sx = x - 30 + Math.random() * 60;
          const sy = y - 45 + Math.random() * 70;
          g.fillStyle(color, 0.3 + Math.random() * 0.3);
          g.fillCircle(sx, sy, 1.5);
        }
        break;

      case 'uppercut':
        // Fire trail upward
        for (let i = 0; i < 4; i++) {
          const fy = y + 10 - i * 18;
          const size = 6 + i * 2;
          g.fillStyle(color, alpha * (0.4 + i * 0.15));
          g.fillTriangle(x + 15 - size / 2, fy + size, x + 15 + size / 2, fy + size, x + 15, fy - size);
        }
        break;

      case 'slide':
        // Ice trail behind feet
        g.lineStyle(2, color, alpha);
        g.lineBetween(x - 50, y + 42, x + 10, y + 42);
        // Ice crystals
        for (let i = 0; i < 3; i++) {
          const cx2 = x - 40 + i * 18;
          const cy2 = y + 34;
          g.lineStyle(1.5, color, alpha * 0.8);
          g.lineBetween(cx2, cy2, cx2 - 3, cy2 - 8);
          g.lineBetween(cx2, cy2, cx2 + 3, cy2 - 8);
          g.lineBetween(cx2, cy2, cx2, cy2 - 10);
        }
        break;

      case 'lightningDrop':
        // Lightning bolt
        g.lineStyle(2.5, color, alpha * 1.2);
        g.beginPath();
        g.moveTo(x + 5, y - 55);
        g.lineTo(x - 5, y - 30);
        g.lineTo(x + 8, y - 30);
        g.lineTo(x - 2, y - 5);
        g.strokePath();
        // Sparks
        for (let i = 0; i < 4; i++) {
          const sx = x - 10 + Math.random() * 25;
          const sy = y - 50 + Math.random() * 50;
          g.fillStyle(color, 0.5);
          g.fillCircle(sx, sy, 1.5);
        }
        break;

      case 'flurry':
        // Slash marks
        for (let i = 0; i < 3; i++) {
          const sx = x + 15 + i * 8;
          const sy = y - 35 + i * 15;
          g.lineStyle(2, color, alpha * (0.6 + i * 0.15));
          g.lineBetween(sx - 8, sy - 10, sx + 8, sy + 10);
        }
        break;

      case 'armorSmash':
        // Glowing armor outline
        g.lineStyle(2, color, alpha * 0.8);
        g.strokeCircle(x, y - 20, 32);
        g.lineStyle(1, color, alpha * 0.4);
        g.strokeCircle(x, y - 20, 40);
        break;

      case 'whirlwind':
        // Spinning arcs around fighter
        for (let i = 0; i < 3; i++) {
          const angle = (Math.PI * 2 * i) / 3;
          const r = 35;
          g.lineStyle(2, color, alpha * 0.8);
          g.beginPath();
          g.arc(x, y - 15, r, angle, angle + 1.2);
          g.strokePath();
        }
        break;

      case 'explosion':
        // Radiating burst lines
        for (let i = 0; i < 8; i++) {
          const angle = (Math.PI * 2 * i) / 8;
          const r1 = 22;
          const r2 = 38 + (i % 2) * 8;
          g.lineStyle(2, color, alpha * 0.7);
          g.lineBetween(
            x + Math.cos(angle) * r1, y - 15 + Math.sin(angle) * r1,
            x + Math.cos(angle) * r2, y - 15 + Math.sin(angle) * r2
          );
        }
        break;
    }
  }

  startFight() {
    this.registry.set('p1Fighter', this.p1Index);
    this.registry.set('p2Fighter', this.p2Index);
    this.scene.start('MapSelectScene');
  }
}
