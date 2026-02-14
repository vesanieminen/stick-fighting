import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { Fighter } from '../fighters/Fighter.js';
import { FIGHTERS } from '../fighters/FighterData.js';
import { MAPS } from '../maps/MapData.js';
import { MapRenderer } from '../maps/MapRenderer.js';
import { InputManager } from '../input/InputManager.js';
import { AIController } from '../input/AIController.js';
import { HealthBar } from '../ui/HealthBar.js';
import { RoundIndicator } from '../ui/RoundIndicator.js';
import { SoundManager } from '../audio/SoundManager.js';

export class FightScene extends Phaser.Scene {
  constructor() {
    super('FightScene');
  }

  create() {
    this.p1Wins = this.registry.get('p1Wins');
    this.p2Wins = this.registry.get('p2Wins');
    this.currentRound = this.registry.get('currentRound');
    this.roundActive = false;

    this.gamePaused = false;
    this.pauseMenuItems = [];
    this.pauseMenuIndex = 0;
    this.pauseGroup = null;

    // Load selected map
    const mapIndex = this.registry.get('selectedMap') || 0;
    this.mapData = MAPS[mapIndex] || MAPS[0];
    this.hasLava = this.mapData.hazards.some(h => h.type === 'lava');
    this.lavaDmgTimer1 = 0;
    this.lavaDmgTimer2 = 0;

    this.createArena();
    this.createFighters();
    this.createUI();
    this.createPauseMenu();
    this.startRound();
  }

  createArena() {
    const map = this.mapData;

    // Use MapRenderer to draw the map
    this.mapRenderer = new MapRenderer(this, map);
    this.mapRenderer.draw();

    // Set physics world bounds using map data
    this.physics.world.setBounds(
      map.stageLeft, 0,
      map.stageRight - map.stageLeft,
      map.groundY
    );

    // Ground collider (static body)
    this.ground = this.add.zone(640, map.groundY + 10, 1280, 20);
    this.physics.add.existing(this.ground, true);

    // Platform colliders (one-way: can jump through from below, land on top)
    this.platformBodies = [];
    for (const p of map.platforms) {
      const zone = this.add.zone(p.x + p.width / 2, p.y + p.height / 2, p.width, p.height);
      this.physics.add.existing(zone, true);
      // Disable side and bottom collisions for one-way platforms
      zone.body.checkCollision.down = false;
      zone.body.checkCollision.left = false;
      zone.body.checkCollision.right = false;
      this.platformBodies.push(zone);
    }
  }

  createFighters() {
    const map = this.mapData;
    const p1X = map.p1SpawnX;
    const p2X = map.p2SpawnX;

    const p1Data = FIGHTERS[this.registry.get('p1Fighter') || 0];
    const p2Data = FIGHTERS[this.registry.get('p2Fighter') || 1];
    this.p1Data = p1Data;
    this.p2Data = p2Data;

    const p1Y = map.p1SpawnY ?? map.groundY;
    const p2Y = map.p2SpawnY ?? map.groundY;

    this.fighter1 = new Fighter(this, p1X, p1Y, 0, true, p1Data);
    this.fighter2 = new Fighter(this, p2X, p2Y, 1, false, p2Data);

    // Cross-reference for teleport special
    this.fighter1.opponent = this.fighter2;
    this.fighter2.opponent = this.fighter1;

    // Ground collision
    this.physics.add.collider(this.fighter1.body, this.ground);
    this.physics.add.collider(this.fighter2.body, this.ground);

    // Platform collisions for both fighters
    for (const plat of this.platformBodies) {
      this.physics.add.collider(this.fighter1.body, plat);
      this.physics.add.collider(this.fighter2.body, plat);
    }

    // Fighter-to-fighter collision (they push each other)
    this.physics.add.collider(this.fighter1.body, this.fighter2.body);

    // Input managers
    this.p1Input = new InputManager(this, 0);
    const playerCount = this.registry.get('playerCount') || 2;
    if (playerCount === 1) {
      this.p2Input = new AIController(this, this.fighter2, this.fighter1);
    } else {
      this.p2Input = new InputManager(this, 1);
    }
  }

  createUI() {
    const barWidth = 480;
    const barHeight = 28;
    const barY = 25;

    // Health bars
    this.p1HealthBar = new HealthBar(this, 50, barY, barWidth, barHeight, 0);
    this.p2HealthBar = new HealthBar(this, 750, barY, barWidth, barHeight, 1);

    // Player names
    this.add.text(50, barY - 18, this.p1Data.name, {
      fontSize: '14px', fontFamily: 'monospace',
      color: `#${this.p1Data.color.toString(16).padStart(6, '0')}`
    });
    this.add.text(1230, barY - 18, this.p2Data.name, {
      fontSize: '14px', fontFamily: 'monospace',
      color: `#${this.p2Data.color.toString(16).padStart(6, '0')}`
    }).setOrigin(1, 0);

    // Round indicators
    this.p1RoundInd = new RoundIndicator(this, 50, barY + barHeight + 18, false);
    this.p2RoundInd = new RoundIndicator(this, 1230, barY + barHeight + 18, true);

    // VS text
    this.add.text(640, barY + 5, 'VS', {
      fontSize: '20px', fontFamily: 'monospace', color: '#666666', fontStyle: 'bold'
    }).setOrigin(0.5);

    // Round display
    this.roundText = this.add.text(640, barY + barHeight + 15, `Round ${this.currentRound}`, {
      fontSize: '13px', fontFamily: 'monospace', color: '#555555'
    }).setOrigin(0.5);

    // Special cooldown bars (below round indicators)
    const spBarW = 80;
    const spBarH = 6;
    const spBarY = barY + barHeight + 38;
    this.spBarConfig = { w: spBarW, h: spBarH };

    this.add.text(50, spBarY - 2, 'SP', {
      fontSize: '9px', fontFamily: 'monospace', color: '#666666'
    });
    this.add.text(1230, spBarY - 2, 'SP', {
      fontSize: '9px', fontFamily: 'monospace', color: '#666666'
    }).setOrigin(1, 0);

    this.p1SpBar = this.add.graphics();
    this.p1SpBarX = 68;
    this.p1SpBarY = spBarY;
    this.p2SpBar = this.add.graphics();
    this.p2SpBarX = 1230 - spBarW;
    this.p2SpBarY = spBarY;

    // Update UI once
    this.p1HealthBar.update(GAME_CONFIG.MAX_HEALTH, GAME_CONFIG.MAX_HEALTH);
    this.p2HealthBar.update(GAME_CONFIG.MAX_HEALTH, GAME_CONFIG.MAX_HEALTH);
    this.p1RoundInd.update(this.p1Wins);
    this.p2RoundInd.update(this.p2Wins);
  }

  createPauseMenu() {
    // ESC key to toggle pause
    this.escKey = this.input.keyboard.addKey('ESC');
    this.escKey.on('down', () => {
      if (this.gamePaused) {
        this.resumeGame();
      } else {
        this.pauseGame();
      }
    });

    // Navigation keys (both P1 and P2 keys work in menu)
    this.pauseUpKeys = [
      this.input.keyboard.addKey('W'),
      this.input.keyboard.addKey('UP'),
    ];
    this.pauseDownKeys = [
      this.input.keyboard.addKey('S'),
      this.input.keyboard.addKey('DOWN'),
    ];
    this.pauseConfirmKeys = [
      this.input.keyboard.addKey('ENTER'),
      this.input.keyboard.addKey('J'),
      this.input.keyboard.addKey('COMMA'),
      this.input.keyboard.addKey('SPACE'),
    ];

    // Gamepad previous state for edge detection in pause menu
    this._padPrevStart = [false, false];
    this._padPrevUp = [false, false];
    this._padPrevDown = [false, false];
    this._padPrevA = [false, false];

    // Build the overlay (hidden initially)
    this.pauseGroup = this.add.container(0, 0).setDepth(500).setVisible(false);

    // Dim overlay
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, 1280, 720);
    this.pauseGroup.add(overlay);

    // Title
    const title = this.add.text(640, 220, 'PAUSED', {
      fontSize: '56px', fontFamily: 'monospace', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.pauseGroup.add(title);

    // Menu options — includes Map Select
    const options = ['Resume', 'Restart Match', 'Map Select', 'Character Select'];
    const startY = 310;
    const spacing = 50;

    this.pauseMenuTexts = options.map((label, i) => {
      const text = this.add.text(640, startY + i * spacing, label, {
        fontSize: '28px', fontFamily: 'monospace', color: '#888888'
      }).setOrigin(0.5);
      this.pauseGroup.add(text);
      return text;
    });

    // Hint
    const hint = this.add.text(640, startY + options.length * spacing + 30, 'ESC to resume', {
      fontSize: '14px', fontFamily: 'monospace', color: '#555555'
    }).setOrigin(0.5);
    this.pauseGroup.add(hint);
  }

  pauseGame() {
    if (this.gamePaused) return;
    this.gamePaused = true;
    this.physics.world.pause();
    this.pauseMenuIndex = 0;
    this.updatePauseMenuHighlight();
    this.pauseGroup.setVisible(true);
    SoundManager.menuSelect();
  }

  resumeGame() {
    if (!this.gamePaused) return;
    this.gamePaused = false;
    this.physics.world.resume();
    this.pauseGroup.setVisible(false);
  }

  updatePauseMenuHighlight() {
    this.pauseMenuTexts.forEach((text, i) => {
      if (i === this.pauseMenuIndex) {
        text.setColor('#ffcc00');
        text.setFontSize('32px');
      } else {
        text.setColor('#888888');
        text.setFontSize('28px');
      }
    });
  }

  _getPads() {
    const pads = [];
    if (this.input.gamepad) {
      if (this.input.gamepad.pad1) pads.push(this.input.gamepad.pad1);
      if (this.input.gamepad.pad2) pads.push(this.input.gamepad.pad2);
    }
    return pads;
  }

  checkGamepadPause() {
    const pads = this._getPads();
    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i];
      if (!pad || !pad.connected) continue;
      // Start button (button index 9) — edge detect
      const startDown = pad.buttons[9] && pad.buttons[9].pressed;
      if (startDown && !this._padPrevStart[i]) {
        this._padPrevStart[i] = true;
        if (this.gamePaused) {
          this.resumeGame();
        } else {
          this.pauseGame();
        }
        return;
      }
      if (!startDown) this._padPrevStart[i] = false;
    }
  }

  handlePauseInput() {
    // Keyboard: navigate up
    for (const key of this.pauseUpKeys) {
      if (Phaser.Input.Keyboard.JustDown(key)) {
        this.pauseMenuIndex = (this.pauseMenuIndex - 1 + this.pauseMenuTexts.length) % this.pauseMenuTexts.length;
        this.updatePauseMenuHighlight();
        SoundManager.menuSelect();
        return;
      }
    }
    // Keyboard: navigate down
    for (const key of this.pauseDownKeys) {
      if (Phaser.Input.Keyboard.JustDown(key)) {
        this.pauseMenuIndex = (this.pauseMenuIndex + 1) % this.pauseMenuTexts.length;
        this.updatePauseMenuHighlight();
        SoundManager.menuSelect();
        return;
      }
    }
    // Keyboard: confirm
    for (const key of this.pauseConfirmKeys) {
      if (Phaser.Input.Keyboard.JustDown(key)) {
        this.executePauseOption(this.pauseMenuIndex);
        return;
      }
    }

    // Gamepad: navigate and confirm
    const pads = this._getPads();
    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i];
      if (!pad || !pad.connected) continue;

      const upDown = pad.up;
      const downDown = pad.down;
      const aDown = pad.A;

      if (upDown && !this._padPrevUp[i]) {
        this.pauseMenuIndex = (this.pauseMenuIndex - 1 + this.pauseMenuTexts.length) % this.pauseMenuTexts.length;
        this.updatePauseMenuHighlight();
        SoundManager.menuSelect();
      }
      if (downDown && !this._padPrevDown[i]) {
        this.pauseMenuIndex = (this.pauseMenuIndex + 1) % this.pauseMenuTexts.length;
        this.updatePauseMenuHighlight();
        SoundManager.menuSelect();
      }
      if (aDown && !this._padPrevA[i]) {
        this.executePauseOption(this.pauseMenuIndex);
      }

      this._padPrevUp[i] = upDown;
      this._padPrevDown[i] = downDown;
      this._padPrevA[i] = aDown;
    }
  }

  executePauseOption(index) {
    switch (index) {
      case 0: // Resume
        this.resumeGame();
        break;
      case 1: // Restart Match
        this.resumeGame();
        this.registry.set('p1Wins', 0);
        this.registry.set('p2Wins', 0);
        this.registry.set('currentRound', 1);
        this.cleanUp();
        this.scene.restart();
        break;
      case 2: // Map Select
        this.resumeGame();
        this.cleanUp();
        this.scene.start('MapSelectScene');
        break;
      case 3: // Character Select
        this.resumeGame();
        this.cleanUp();
        this.scene.start('CharacterSelectScene');
        break;
    }
  }

  startRound() {
    this.roundActive = false;

    // Show round announcement
    const announce = this.add.text(640, 300, `ROUND ${this.currentRound}`, {
      fontSize: '64px', fontFamily: 'monospace', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(200);

    this.time.delayedCall(1000, () => {
      announce.setText('FIGHT!');
      announce.setColor('#ffcc00');
      announce.setFontSize('80px');
      SoundManager.roundStart();

      this.time.delayedCall(600, () => {
        this.tweens.add({
          targets: announce,
          alpha: 0,
          duration: 300,
          onComplete: () => announce.destroy()
        });
        this.roundActive = true;
      });
    });
  }

  update(time, delta) {
    // Gamepad Start button toggles pause (must run always)
    this.checkGamepadPause();

    // Handle pause menu navigation when paused
    if (this.gamePaused) {
      this.handlePauseInput();
      return;
    }

    // Update animated map elements (lava, etc.)
    if (this.mapRenderer) {
      this.mapRenderer.update(time);
    }

    // Always update UI
    this.p1HealthBar.update(this.fighter1.health, this.fighter1.maxHealth);
    this.p2HealthBar.update(this.fighter2.health, this.fighter2.maxHealth);
    this.p1RoundInd.update(this.p1Wins);
    this.p2RoundInd.update(this.p2Wins);

    // Special cooldown bars
    this.drawSpBar(this.p1SpBar, this.p1SpBarX, this.p1SpBarY, this.fighter1.specialCooldown, this.p1Data.color);
    this.drawSpBar(this.p2SpBar, this.p2SpBarX, this.p2SpBarY, this.fighter2.specialCooldown, this.p2Data.color);

    if (!this.roundActive) return;

    // Read input
    const p1Actions = this.p1Input.getActions();
    const p2Actions = this.p2Input.getActions();

    // Update fighters
    this.fighter1.update(delta, p1Actions);
    this.fighter2.update(delta, p2Actions);

    // Keep fighters facing each other
    this.updateFacing();

    // Lava damage
    if (this.hasLava) {
      this.checkLavaDamage(this.fighter1, delta, 1);
      this.checkLavaDamage(this.fighter2, delta, 2);
    }

    // Hit detection
    this.checkHits(this.fighter1, this.fighter2);
    this.checkHits(this.fighter2, this.fighter1);

    // Check KO
    if (this.fighter1.health <= 0 && this.fighter1.state === 'KO') {
      this.endRound(1); // P2 wins
    } else if (this.fighter2.health <= 0 && this.fighter2.state === 'KO') {
      this.endRound(0); // P1 wins
    }
  }

  checkLavaDamage(fighter, delta, playerNum) {
    // Fighter feet position = body center Y + half height
    const feetY = fighter.body.y + GAME_CONFIG.BODY_HEIGHT / 2;
    const lavaY = this.mapData.groundY;

    // If feet are at or below lava surface (within 10px tolerance)
    if (feetY < lavaY - 10) return;
    if (fighter.state === 'KO') return;

    // Tick damage every 300ms
    const timerKey = playerNum === 1 ? 'lavaDmgTimer1' : 'lavaDmgTimer2';
    this[timerKey] += delta;
    if (this[timerKey] < 300) return;
    this[timerKey] = 0;

    // 5 damage per tick, small upward bounce to let them escape
    const dmg = 5;
    fighter.health -= dmg;
    fighter.health = Math.max(0, fighter.health);
    fighter.body.body.setVelocityY(-300);

    // Fire visual feedback
    this.createLavaSpark(fighter.body.x, lavaY);

    // Screen shake
    this.cameras.main.shake(80, 0.003);
    SoundManager.hit();

    if (fighter.health <= 0) {
      fighter.enterState('KO');
      fighter.canAct = false;
    }
  }

  createLavaSpark(x, y) {
    const g = this.add.graphics().setDepth(50);
    for (let i = 0; i < 6; i++) {
      const angle = -Math.PI * (0.1 + Math.random() * 0.8);
      const len = 10 + Math.random() * 15;
      const color = [0xff2200, 0xff6600, 0xffcc00][i % 3];
      g.lineStyle(2, color, 1);
      g.lineBetween(x, y, x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    }
    this.tweens.add({
      targets: g,
      alpha: 0,
      duration: 250,
      onComplete: () => g.destroy()
    });
  }

  updateFacing() {
    if (this.fighter1.x < this.fighter2.x) {
      this.fighter1.setFacing(true);
      this.fighter2.setFacing(false);
    } else {
      this.fighter1.setFacing(false);
      this.fighter2.setFacing(true);
    }
  }

  checkHits(attacker, defender) {
    if (!attacker.isAttacking() || !attacker.isOnActiveFrame() || attacker.hasHit) return;

    const hitbox = attacker.getHitboxRect();
    const hurtbox = defender.getHurtboxRect();

    if (!hitbox || !hurtbox) return;

    if (Phaser.Geom.Rectangle.Overlaps(hitbox, hurtbox)) {
      attacker.hasHit = true;
      const attackData = attacker.getAttackData();
      const knockDir = attacker.facingRight ? 1 : -1;
      const wasBlocking = defender.state === 'BLOCK';

      defender.takeDamage(attackData.damage, knockDir * attackData.knockback);

      // Block advantage — punish the attacker for hitting into a block
      if (wasBlocking) {
        attacker.onAttackBlocked(knockDir);
        SoundManager.block();
      } else {
        SoundManager.hit();

        // Show combo counter for multi-hit chains
        if (attacker.comboChain.length > 0) {
          this.showComboText(attacker, attacker.comboChain.length);
        }
      }

      // Visual feedback - screen shake
      this.cameras.main.shake(100, 0.005 * attackData.damage);

      // Hit spark at the intersection of hitbox and hurtbox (on the defender)
      const overlapX = Math.max(hitbox.x, hurtbox.x);
      const overlapX2 = Math.min(hitbox.x + hitbox.width, hurtbox.x + hurtbox.width);
      const overlapY = Math.max(hitbox.y, hurtbox.y);
      const overlapY2 = Math.min(hitbox.y + hitbox.height, hurtbox.y + hurtbox.height);
      this.createHitSpark(
        (overlapX + overlapX2) / 2,
        (overlapY + overlapY2) / 2,
        wasBlocking
      );
    }
  }

  showComboText(fighter, hitCount) {
    const isFinisher = fighter.comboFinisher;
    const color = isFinisher ? '#ff3333' : '#ffcc00';
    const fontSize = isFinisher ? '32px' : '24px';
    const label = `${hitCount} HIT${isFinisher ? '!' : ''}`;

    const text = this.add.text(fighter.x, fighter.y - GAME_CONFIG.BODY_HEIGHT, label, {
      fontSize, fontFamily: 'monospace', color, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: text,
      y: text.y - 40,
      alpha: 0,
      duration: 600,
      ease: 'Power2',
      onComplete: () => text.destroy()
    });
  }

  createHitSpark(x, y, isBlocked) {
    const g = this.add.graphics();
    g.setDepth(50);

    const color = isBlocked ? 0x4488ff : 0xffaa00;
    const size = isBlocked ? 15 : 25;

    // Draw a burst of lines
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const len = size + Math.random() * 10;
      g.lineStyle(3, color, 1);
      g.lineBetween(
        x, y,
        x + Math.cos(angle) * len,
        y + Math.sin(angle) * len
      );
    }

    // Fade out and destroy
    this.tweens.add({
      targets: g,
      alpha: 0,
      duration: 200,
      onComplete: () => g.destroy()
    });
  }

  drawSpBar(graphics, x, y, cooldown, color) {
    const { w, h } = this.spBarConfig;
    const fill = cooldown <= 0 ? 1 : 1 - cooldown / GAME_CONFIG.SPECIAL_COOLDOWN;

    graphics.clear();
    // Background
    graphics.fillStyle(0x111122, 0.8);
    graphics.fillRect(x, y, w, h);
    // Fill
    const barColor = fill >= 1 ? 0xffcc00 : color;
    graphics.fillStyle(barColor, fill >= 1 ? 0.9 : 0.6);
    graphics.fillRect(x, y, w * fill, h);
    // Border
    graphics.lineStyle(1, fill >= 1 ? 0xffcc00 : 0x444466, 0.8);
    graphics.strokeRect(x, y, w, h);
  }

  endRound(winnerIndex) {
    this.roundActive = false;

    if (winnerIndex === 0) this.p1Wins++;
    else this.p2Wins++;

    // Set fighter states
    const winner = winnerIndex === 0 ? this.fighter1 : this.fighter2;
    const loser = winnerIndex === 0 ? this.fighter2 : this.fighter1;
    winner.enterState('VICTORY');
    loser.enterState('KO');

    // KO text
    const koText = this.add.text(640, 300, 'K.O.!', {
      fontSize: '80px', fontFamily: 'monospace', color: '#ff3333', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(200);

    SoundManager.ko();
    this.cameras.main.shake(300, 0.01);

    this.time.delayedCall(GAME_CONFIG.ROUND_END_DELAY, () => {
      koText.destroy();

      // Check if match is over
      if (this.p1Wins >= GAME_CONFIG.ROUNDS_TO_WIN || this.p2Wins >= GAME_CONFIG.ROUNDS_TO_WIN) {
        this.registry.set('p1Wins', this.p1Wins);
        this.registry.set('p2Wins', this.p2Wins);
        this.registry.set('matchWinner', winnerIndex);
        this.cleanUp();
        this.scene.start('ResultScene');
      } else {
        // Next round
        this.registry.set('p1Wins', this.p1Wins);
        this.registry.set('p2Wins', this.p2Wins);
        this.registry.set('currentRound', this.currentRound + 1);
        this.cleanUp();
        this.scene.restart();
      }
    });
  }

  cleanUp() {
    this.fighter1.destroy();
    this.fighter2.destroy();
    this.p1HealthBar.destroy();
    this.p2HealthBar.destroy();
    this.p1RoundInd.destroy();
    this.p2RoundInd.destroy();
    if (this.mapRenderer) {
      this.mapRenderer.destroy();
      this.mapRenderer = null;
    }
  }
}
