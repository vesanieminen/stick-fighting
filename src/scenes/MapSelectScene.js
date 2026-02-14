import Phaser from 'phaser';
import { MAPS } from '../maps/MapData.js';
import { MapRenderer } from '../maps/MapRenderer.js';
import { SoundManager } from '../audio/SoundManager.js';

const MAP_COUNT = MAPS.length;
const COLS = 5;
const ROWS = Math.ceil(MAP_COUNT / COLS);
const CELL_W = 220;
const CELL_H = 140;
const GRID_GAP_X = 10;
const GRID_GAP_Y = 10;
const TOTAL_W = COLS * CELL_W + (COLS - 1) * GRID_GAP_X;
const GRID_X = (1280 - TOTAL_W) / 2;
const GRID_Y = 110;

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
    this.add.text(640, 28, 'SELECT MAP', {
      fontSize: '32px', fontFamily: 'monospace', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);

    const instructionsText = this.isCPU
      ? 'P1: WASD + J to lock'
      : 'P1: WASD + J to lock    P2: Arrows + , to lock';
    this.add.text(640, 64, instructionsText, {
      fontSize: '13px', fontFamily: 'monospace', color: '#666666'
    }).setOrigin(0.5);

    // Draw map cells with previews
    this.cellGraphics = [];
    for (let i = 0; i < MAP_COUNT; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = GRID_X + col * (CELL_W + GRID_GAP_X) + CELL_W / 2;
      const cy = GRID_Y + row * (CELL_H + GRID_GAP_Y) + CELL_H / 2;

      const map = MAPS[i];

      // Cell background
      const g = this.add.graphics();
      this.cellGraphics.push(g);

      // Mini map preview
      const previewG = this.add.graphics();
      const renderer = new MapRenderer(this, map);
      renderer.drawPreview(previewG, cx, cy - 6, CELL_W - 20, CELL_H - 36);

      // Map name below preview
      this.add.text(cx, cy + CELL_H / 2 - 12, map.name, {
        fontSize: '11px', fontFamily: 'monospace', color: '#aaaaaa'
      }).setOrigin(0.5);
    }

    // Info panel below grid
    const infoPanelY = GRID_Y + ROWS * (CELL_H + GRID_GAP_Y) + 10;

    this.mapInfo = this.add.text(640, infoPanelY, '', {
      fontSize: '18px', fontFamily: 'monospace', color: '#cccccc'
    }).setOrigin(0.5, 0);

    this.mapDesc = this.add.text(640, infoPanelY + 28, '', {
      fontSize: '14px', fontFamily: 'monospace', color: '#888888'
    }).setOrigin(0.5, 0);

    // P1/P2 labels
    const labelY = infoPanelY + 62;
    this.add.text(320, labelY, 'PLAYER 1', {
      fontSize: '18px', fontFamily: 'monospace', color: '#ffcc00', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(960, labelY, this.isCPU ? 'CPU' : 'PLAYER 2', {
      fontSize: '18px', fontFamily: 'monospace', color: '#00ccff', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.p1SelectText = this.add.text(320, labelY + 26, '', {
      fontSize: '14px', fontFamily: 'monospace', color: '#ffcc00'
    }).setOrigin(0.5);

    this.p2SelectText = this.add.text(960, labelY + 26, '', {
      fontSize: '14px', fontFamily: 'monospace', color: '#00ccff'
    }).setOrigin(0.5);

    // Lock status
    this.p1LockText = this.add.text(320, labelY + 50, '', {
      fontSize: '16px', fontFamily: 'monospace', color: '#00ff00'
    }).setOrigin(0.5);

    this.p2LockText = this.add.text(960, labelY + 50, '', {
      fontSize: '16px', fontFamily: 'monospace', color: '#00ff00'
    }).setOrigin(0.5);

    // Start prompt
    this.startText = this.add.text(640, labelY + 80, '', {
      fontSize: '18px', fontFamily: 'monospace', color: '#ffcc00'
    }).setOrigin(0.5);

    // Selection highlight graphics
    this.highlightGraphics = this.add.graphics();
    this.highlightGraphics.setDepth(50);

    // Keyboard input
    this.p1Keys = {
      left: this.input.keyboard.addKey('A'),
      right: this.input.keyboard.addKey('D'),
      up: this.input.keyboard.addKey('W'),
      down: this.input.keyboard.addKey('S'),
      confirm: this.input.keyboard.addKey('J'),
      cancel: this.input.keyboard.addKey('K'),
    };

    this.p2Keys = {
      left: this.input.keyboard.addKey('LEFT'),
      right: this.input.keyboard.addKey('RIGHT'),
      up: this.input.keyboard.addKey('UP'),
      down: this.input.keyboard.addKey('DOWN'),
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

    // P2 navigation (disabled for CPU — follows P1)
    if (!this.isCPU) {
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
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);

    let newCol = col + dx;
    let newRow = row + dy;

    // Wrap columns
    if (newCol < 0) newCol = COLS - 1;
    if (newCol >= COLS) newCol = 0;

    // Wrap rows
    if (newRow < 0) newRow = ROWS - 1;
    if (newRow >= ROWS) newRow = 0;

    let newIdx = newRow * COLS + newCol;

    // Clamp to valid map range (last row may not be full)
    if (newIdx >= MAP_COUNT) {
      // Try to stay in the same column on the other row
      newIdx = col;
    }

    if (player === 1) {
      this.p1Index = newIdx;
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

  getCellPosition(index) {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    return {
      x: GRID_X + col * (CELL_W + GRID_GAP_X),
      y: GRID_Y + row * (CELL_H + GRID_GAP_Y),
    };
  }

  updateDisplay() {
    const hg = this.highlightGraphics;
    hg.clear();

    // Draw cell backgrounds
    for (let i = 0; i < MAP_COUNT; i++) {
      const pos = this.getCellPosition(i);
      const g = this.cellGraphics[i];
      g.clear();

      g.fillStyle(0x1a1a3e, 0.6);
      g.fillRect(pos.x + 4, pos.y + 4, CELL_W - 8, CELL_H - 8);
      g.lineStyle(1, 0x333366, 0.8);
      g.strokeRect(pos.x + 4, pos.y + 4, CELL_W - 8, CELL_H - 8);
    }

    // P1 highlight (yellow border)
    const p1Pos = this.getCellPosition(this.p1Index);
    hg.lineStyle(3, this.p1Locked ? 0x00ff00 : 0xffcc00, 1);
    hg.strokeRect(p1Pos.x + 2, p1Pos.y + 2, CELL_W - 4, CELL_H - 4);

    // P1 marker triangle (top-left)
    hg.fillStyle(this.p1Locked ? 0x00ff00 : 0xffcc00, 1);
    hg.fillTriangle(p1Pos.x + 10, p1Pos.y + 8, p1Pos.x + 22, p1Pos.y + 8, p1Pos.x + 16, p1Pos.y + 18);

    // P2 highlight (cyan border)
    const p2Pos = this.getCellPosition(this.p2Index);
    hg.lineStyle(3, this.p2Locked ? 0x00ff00 : 0x00ccff, 1);
    hg.strokeRect(p2Pos.x + 6, p2Pos.y + 6, CELL_W - 12, CELL_H - 12);

    // P2 marker triangle (top-right)
    hg.fillStyle(this.p2Locked ? 0x00ff00 : 0x00ccff, 1);
    hg.fillTriangle(
      p2Pos.x + CELL_W - 10, p2Pos.y + 8,
      p2Pos.x + CELL_W - 22, p2Pos.y + 8,
      p2Pos.x + CELL_W - 16, p2Pos.y + 18
    );

    // Info panel
    const p1Map = MAPS[this.p1Index];
    this.mapInfo.setText(p1Map.name);
    this.mapDesc.setText(p1Map.description);

    this.p1SelectText.setText(MAPS[this.p1Index].name);
    this.p2SelectText.setText(MAPS[this.p2Index].name);

    this.p1LockText.setText(this.p1Locked ? 'LOCKED IN!' : '');
    this.p2LockText.setText(this.p2Locked ? 'LOCKED IN!' : '');

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
      chosenMap = Math.random() < 0.5 ? this.p1Index : this.p2Index;
    }

    this.registry.set('selectedMap', chosenMap);
    this.registry.set('p1Wins', 0);
    this.registry.set('p2Wins', 0);
    this.registry.set('currentRound', 1);
    this.scene.start('FightScene');
  }
}
