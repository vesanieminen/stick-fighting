import Phaser from 'phaser';
import { MAPS } from '../maps/MapData.js';
import { MapRenderer } from '../maps/MapRenderer.js';
import { SoundManager } from '../audio/SoundManager.js';

const MAP_COUNT = MAPS.length;
const CELL_W = 210;
const CELL_H = 160;
const GRID_X = (1280 - MAP_COUNT * CELL_W) / 2; // center the row
const GRID_Y = 160;

export class MapSelectScene extends Phaser.Scene {
  constructor() {
    super('MapSelectScene');
  }

  create() {
    this.playerCount = this.registry.get('playerCount') || 2;
    this.isCPU = this.playerCount === 1;

    this.p1Index = 0;
    this.p2Index = 0;
    this.p1Locked = false;
    this.p2Locked = false;

    // Title
    this.add.text(640, 40, 'SELECT MAP', {
      fontSize: '36px', fontFamily: 'monospace', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);

    const instructionsText = this.isCPU
      ? 'P1: A/D + J to lock'
      : 'P1: A/D + J to lock    P2: Arrows + , to lock';
    this.add.text(640, 80, instructionsText, {
      fontSize: '14px', fontFamily: 'monospace', color: '#666666'
    }).setOrigin(0.5);

    // Draw map cells with previews
    this.cellGraphics = [];
    for (let i = 0; i < MAP_COUNT; i++) {
      const cx = GRID_X + i * CELL_W + CELL_W / 2;
      const cy = GRID_Y + CELL_H / 2;

      const map = MAPS[i];

      // Cell background
      const g = this.add.graphics();
      this.cellGraphics.push(g);

      // Mini map preview
      const previewG = this.add.graphics();
      const renderer = new MapRenderer(this, map);
      renderer.drawPreview(previewG, cx, cy, CELL_W - 24, CELL_H - 40);

      // Map name below preview
      this.add.text(cx, cy + CELL_H / 2 - 14, map.name, {
        fontSize: '12px', fontFamily: 'monospace', color: '#aaaaaa'
      }).setOrigin(0.5);
    }

    // Info panel at the bottom
    this.mapInfo = this.add.text(640, 380, '', {
      fontSize: '18px', fontFamily: 'monospace', color: '#cccccc'
    }).setOrigin(0.5, 0);

    this.mapDesc = this.add.text(640, 410, '', {
      fontSize: '14px', fontFamily: 'monospace', color: '#888888'
    }).setOrigin(0.5, 0);

    // P1/P2 labels
    this.add.text(320, 450, 'PLAYER 1', {
      fontSize: '20px', fontFamily: 'monospace', color: '#ffcc00', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(960, 450, this.isCPU ? 'CPU' : 'PLAYER 2', {
      fontSize: '20px', fontFamily: 'monospace', color: '#00ccff', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.p1SelectText = this.add.text(320, 480, '', {
      fontSize: '16px', fontFamily: 'monospace', color: '#ffcc00'
    }).setOrigin(0.5);

    this.p2SelectText = this.add.text(960, 480, '', {
      fontSize: '16px', fontFamily: 'monospace', color: '#00ccff'
    }).setOrigin(0.5);

    // Lock status
    this.p1LockText = this.add.text(320, 510, '', {
      fontSize: '18px', fontFamily: 'monospace', color: '#00ff00'
    }).setOrigin(0.5);

    this.p2LockText = this.add.text(960, 510, '', {
      fontSize: '18px', fontFamily: 'monospace', color: '#00ff00'
    }).setOrigin(0.5);

    // Start prompt
    this.startText = this.add.text(640, 560, '', {
      fontSize: '20px', fontFamily: 'monospace', color: '#ffcc00'
    }).setOrigin(0.5);

    // Selection highlight graphics
    this.highlightGraphics = this.add.graphics();
    this.highlightGraphics.setDepth(50);

    // Keyboard input
    this.p1Keys = {
      left: this.input.keyboard.addKey('A'),
      right: this.input.keyboard.addKey('D'),
      confirm: this.input.keyboard.addKey('J'),
      cancel: this.input.keyboard.addKey('K'),
    };

    this.p2Keys = {
      left: this.input.keyboard.addKey('LEFT'),
      right: this.input.keyboard.addKey('RIGHT'),
      confirm: this.input.keyboard.addKey('COMMA'),
      cancel: this.input.keyboard.addKey('PERIOD'),
    };

    // Gamepad tracking
    this.p1PadPrev = {};
    this.p2PadPrev = {};

    this.updateDisplay();
  }

  update() {
    // P1 navigation
    if (!this.p1Locked) {
      if (Phaser.Input.Keyboard.JustDown(this.p1Keys.left) || this.padJustPressed(1, 'left')) {
        this.moveSelection(1, -1);
      }
      if (Phaser.Input.Keyboard.JustDown(this.p1Keys.right) || this.padJustPressed(1, 'right')) {
        this.moveSelection(1, 1);
      }
      if (Phaser.Input.Keyboard.JustDown(this.p1Keys.confirm) || this.padJustPressed(1, 'A')) {
        this.lockIn(1);
      }
    } else if (Phaser.Input.Keyboard.JustDown(this.p1Keys.cancel) || this.padJustPressed(1, 'B')) {
      this.unlock(1);
    }

    // P2 navigation (disabled for CPU — follows P1)
    if (!this.isCPU) {
      if (!this.p2Locked) {
        if (Phaser.Input.Keyboard.JustDown(this.p2Keys.left) || this.padJustPressed(2, 'left')) {
          this.moveSelection(2, -1);
        }
        if (Phaser.Input.Keyboard.JustDown(this.p2Keys.right) || this.padJustPressed(2, 'right')) {
          this.moveSelection(2, 1);
        }
        if (Phaser.Input.Keyboard.JustDown(this.p2Keys.confirm) || this.padJustPressed(2, 'A')) {
          this.lockIn(2);
        }
      } else if (Phaser.Input.Keyboard.JustDown(this.p2Keys.cancel) || this.padJustPressed(2, 'B')) {
        this.unlock(2);
      }
    }

    this.updatePadPrev();
  }

  getPad(player) {
    if (!this.input.gamepad) return null;
    const pads = this.input.gamepad.gamepads.filter(p => p && p.connected);
    const idx = player - 1;
    return pads.find(p => p.index === idx) || null;
  }

  padJustPressed(player, button) {
    const pad = this.getPad(player);
    const prev = player === 1 ? this.p1PadPrev : this.p2PadPrev;
    if (!pad) return false;

    const DEADZONE = 0.5;
    const stickX = pad.leftStick ? pad.leftStick.x : 0;

    let current = false;
    switch (button) {
      case 'left': current = pad.left || stickX < -DEADZONE; break;
      case 'right': current = pad.right || stickX > DEADZONE; break;
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

      prev.left = pad.left || stickX < -DEADZONE;
      prev.right = pad.right || stickX > DEADZONE;
      prev.A = pad.A;
      prev.B = pad.B;
    }
  }

  moveSelection(player, dx) {
    const idx = player === 1 ? this.p1Index : this.p2Index;
    let newIdx = idx + dx;

    // Wrap
    if (newIdx < 0) newIdx = MAP_COUNT - 1;
    if (newIdx >= MAP_COUNT) newIdx = 0;

    if (player === 1) {
      this.p1Index = newIdx;
      // CPU follows P1's selection
      if (this.isCPU) this.p2Index = newIdx;
    } else {
      this.p2Index = newIdx;
    }
    SoundManager.menuSelect();
    this.updateDisplay();
  }

  lockIn(player) {
    if (player === 1) this.p1Locked = true;
    else this.p2Locked = true;

    SoundManager.roundStart();
    this.updateDisplay();

    if (player === 1 && this.isCPU && !this.p2Locked) {
      // CPU follows P1's selection
      this.p2Index = this.p1Index;
      this.updateDisplay();
      this.time.delayedCall(300, () => {
        this.lockIn(2);
      });
      return;
    }

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

    // Draw cell backgrounds
    for (let i = 0; i < MAP_COUNT; i++) {
      const x = GRID_X + i * CELL_W;
      const y = GRID_Y;

      const g = this.cellGraphics[i];
      g.clear();

      // Base cell background
      g.fillStyle(0x1a1a3e, 0.6);
      g.fillRect(x + 4, y + 4, CELL_W - 8, CELL_H - 8);
      g.lineStyle(1, 0x333366, 0.8);
      g.strokeRect(x + 4, y + 4, CELL_W - 8, CELL_H - 8);
    }

    // P1 highlight (yellow border)
    const p1x = GRID_X + this.p1Index * CELL_W;
    hg.lineStyle(3, this.p1Locked ? 0x00ff00 : 0xffcc00, 1);
    hg.strokeRect(p1x + 2, GRID_Y + 2, CELL_W - 4, CELL_H - 4);

    // P1 marker triangle (top-left)
    hg.fillStyle(this.p1Locked ? 0x00ff00 : 0xffcc00, 1);
    hg.fillTriangle(p1x + 10, GRID_Y + 8, p1x + 22, GRID_Y + 8, p1x + 16, GRID_Y + 18);

    // P2 highlight (cyan border)
    const p2x = GRID_X + this.p2Index * CELL_W;
    hg.lineStyle(3, this.p2Locked ? 0x00ff00 : 0x00ccff, 1);
    hg.strokeRect(p2x + 6, GRID_Y + 6, CELL_W - 12, CELL_H - 12);

    // P2 marker triangle (top-right)
    hg.fillStyle(this.p2Locked ? 0x00ff00 : 0x00ccff, 1);
    hg.fillTriangle(
      p2x + CELL_W - 10, GRID_Y + 8,
      p2x + CELL_W - 22, GRID_Y + 8,
      p2x + CELL_W - 16, GRID_Y + 18
    );

    // Info panel — show the map that P1 is hovering (or both if different)
    const p1Map = MAPS[this.p1Index];
    this.mapInfo.setText(p1Map.name);
    this.mapDesc.setText(p1Map.description);

    // Player selection texts
    this.p1SelectText.setText(MAPS[this.p1Index].name);
    this.p2SelectText.setText(MAPS[this.p2Index].name);

    // Lock status
    this.p1LockText.setText(this.p1Locked ? 'LOCKED IN!' : '');
    this.p2LockText.setText(this.p2Locked ? 'LOCKED IN!' : '');

    // Start text
    if (this.p1Locked && this.p2Locked) {
      if (this.p1Index === this.p2Index) {
        this.startText.setText(`GET READY — ${MAPS[this.p1Index].name}!`);
      } else {
        this.startText.setText('GET READY — picking randomly...');
      }
    } else {
      this.startText.setText('');
    }
  }

  startFight() {
    let chosenMap;
    if (this.p1Index === this.p2Index) {
      chosenMap = this.p1Index;
    } else {
      // Random pick between the two selections
      chosenMap = Math.random() < 0.5 ? this.p1Index : this.p2Index;
    }

    this.registry.set('selectedMap', chosenMap);
    this.registry.set('p1Wins', 0);
    this.registry.set('p2Wins', 0);
    this.registry.set('currentRound', 1);
    this.scene.start('FightScene');
  }
}
