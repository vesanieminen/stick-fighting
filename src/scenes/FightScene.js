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
import { spawnComboFinisher } from '../effects/SpecialEffects.js';

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
    this.hasSpikes = this.mapData.hazards.some(h => h.type === 'spikes');
    this.isBottomless = !!this.mapData.bottomless;
    this.lavaDmgTimer1 = 0;
    this.lavaDmgTimer2 = 0;
    this.spikeDmgTimer1 = 0;
    this.spikeDmgTimer2 = 0;

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

    // Set physics world bounds — for bottomless maps, extend downward so fighters can fall
    const worldHeight = this.isBottomless ? (map.deathY || 800) + 200 : map.groundY;
    this.physics.world.setBounds(
      map.stageLeft, 0,
      map.stageRight - map.stageLeft,
      worldHeight
    );

    // Ground collider (only for non-bottomless maps)
    this.ground = null;
    if (!map.bottomless) {
      this.ground = this.add.zone(640, map.groundY + 10, 1280, 20);
      this.physics.add.existing(this.ground, true);
    }

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

    // Moving platform colliders
    this.movingPlatBodies = [];
    this.movingPlatDefs = map.movingPlatforms || [];
    for (const mp of this.movingPlatDefs) {
      const zone = this.add.zone(mp.x + mp.width / 2, mp.y + mp.height / 2, mp.width, mp.height);
      this.physics.add.existing(zone, true);
      zone.body.checkCollision.down = false;
      zone.body.checkCollision.left = false;
      zone.body.checkCollision.right = false;
      this.movingPlatBodies.push(zone);
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

    // Wall combo: let fighters check if opponent is near a wall
    this.fighter1.opponentNearWallFn = () => this.isNearWall(this.fighter2);
    this.fighter2.opponentNearWallFn = () => this.isNearWall(this.fighter1);

    // Set ragdoll ground Y for bottomless maps
    if (this.isBottomless) {
      this.fighter1._ragdollGroundY = 2000;
      this.fighter2._ragdollGroundY = 2000;
    }

    // Ground collision (only if ground exists)
    if (this.ground) {
      this.physics.add.collider(this.fighter1.body, this.ground);
      this.physics.add.collider(this.fighter2.body, this.ground);
    }

    // Platform collisions for both fighters
    for (const plat of this.platformBodies) {
      this.physics.add.collider(this.fighter1.body, plat);
      this.physics.add.collider(this.fighter2.body, plat);
    }

    // Moving platform collisions
    for (const plat of this.movingPlatBodies) {
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

    // Update moving platforms
    this.updateMovingPlatforms(time);

    // Update animated map elements (lava, moving platform visuals, etc.)
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

    // Keep updating fighters after round ends so ragdoll/victory anims play out
    if (!this.roundActive) {
      const empty = {};
      this.fighter1.update(delta, empty);
      this.fighter2.update(delta, empty);

      // "Press any button to continue" after a short delay
      if (this.roundEndTimer !== undefined) {
        this.roundEndTimer += delta;
        if (!this.roundEndReady && this.roundEndTimer > 1500) {
          this.roundEndReady = true;
          if (this.continueText) {
            this.continueText.setAlpha(1);
            this.tweens.add({
              targets: this.continueText,
              alpha: { from: 1, to: 0.3 },
              duration: 600,
              yoyo: true,
              repeat: -1,
            });
          }
        }
        if (this.roundEndReady && this.checkContinueInput()) {
          this.roundEndTimer = undefined;
          this.advanceFromKO();
        }
      }

      return;
    }

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

    // Spike damage
    if (this.hasSpikes) {
      this.checkSpikeDamage(this.fighter1, delta, 1);
      this.checkSpikeDamage(this.fighter2, delta, 2);
    }

    // Fall death (bottomless maps)
    if (this.isBottomless) {
      this.checkFallDeath(this.fighter1);
      this.checkFallDeath(this.fighter2);
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
      fighter.createRagdoll(0, -300);
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

  updateMovingPlatforms(time) {
    if (this.movingPlatDefs.length === 0) return;

    const positions = [];
    for (let i = 0; i < this.movingPlatDefs.length; i++) {
      const def = this.movingPlatDefs[i];
      const body = this.movingPlatBodies[i];
      const t = time * 0.001 * def.speed;

      // Oscillate with sine wave
      const offsetX = Math.sin(t) * def.moveX;
      const offsetY = Math.sin(t) * def.moveY;

      const prevX = body.x;
      const newX = def.x + def.width / 2 + offsetX;
      const newY = def.y + def.height / 2 + offsetY;

      body.setPosition(newX, newY);
      body.body.updateFromGameObject();

      // Carry fighters standing on this platform
      const deltaX = newX - prevX;
      if (Math.abs(deltaX) > 0.01) {
        this.carryFighterOnPlatform(this.fighter1, body, deltaX);
        this.carryFighterOnPlatform(this.fighter2, body, deltaX);
      }

      positions.push({
        x: newX - def.width / 2,
        y: newY - def.height / 2,
        width: def.width,
        height: def.height,
        color: def.color,
        lineColor: def.lineColor,
      });
    }

    // Pass positions to renderer for visual sync
    if (this.mapRenderer) {
      this.mapRenderer.movingPlatformPositions = positions;
    }
  }

  carryFighterOnPlatform(fighter, platform, deltaX) {
    if (fighter.state === 'KO') return;
    // Check if fighter is standing on this platform (blocked.down + overlapping horizontally)
    if (!fighter.body.body.blocked.down) return;

    const fBody = fighter.body.body;
    const pBody = platform.body;

    // Fighter feet Y vs platform top Y — must be close
    const feetY = fBody.y + fBody.halfHeight;
    const platTop = pBody.y - pBody.halfHeight;
    if (Math.abs(feetY - platTop) > 8) return;

    // Horizontal overlap check
    const fLeft = fBody.x - fBody.halfWidth;
    const fRight = fBody.x + fBody.halfWidth;
    const pLeft = pBody.x - pBody.halfWidth;
    const pRight = pBody.x + pBody.halfWidth;
    if (fRight < pLeft || fLeft > pRight) return;

    // Carry the fighter
    fighter.body.x += deltaX;
  }

  checkSpikeDamage(fighter, delta, playerNum) {
    const feetY = fighter.body.y + GAME_CONFIG.BODY_HEIGHT / 2;
    const spikeHazard = this.mapData.hazards.find(h => h.type === 'spikes');
    if (!spikeHazard) return;
    const spikeY = spikeHazard.y;

    if (feetY < spikeY - 5) return;
    if (fighter.state === 'KO') return;

    // Tick damage every 400ms
    const timerKey = playerNum === 1 ? 'spikeDmgTimer1' : 'spikeDmgTimer2';
    this[timerKey] += delta;
    if (this[timerKey] < 400) return;
    this[timerKey] = 0;

    // Heavy damage + upward launch
    const dmg = 50;
    fighter.health -= dmg;
    fighter.health = Math.max(0, fighter.health);
    fighter.body.body.setVelocityY(-500);

    // Visual feedback
    this.createSpikeSpark(fighter.body.x, spikeY);
    this.cameras.main.shake(150, 0.01);
    SoundManager.hit();

    if (fighter.health <= 0) {
      fighter.createRagdoll(0, -500);
      fighter.enterState('KO');
      fighter.canAct = false;
    }
  }

  createSpikeSpark(x, y) {
    const g = this.add.graphics().setDepth(50);
    for (let i = 0; i < 8; i++) {
      const angle = -Math.PI * (0.1 + Math.random() * 0.8);
      const len = 8 + Math.random() * 12;
      const color = [0xff3333, 0xff6666, 0xffaaaa][i % 3];
      g.lineStyle(2, color, 1);
      g.lineBetween(x, y, x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    }
    this.tweens.add({
      targets: g,
      alpha: 0,
      duration: 300,
      onComplete: () => g.destroy()
    });
  }

  checkFallDeath(fighter) {
    if (fighter.state === 'KO') return;
    const deathY = this.mapData.deathY || 800;
    const feetY = fighter.body.y + GAME_CONFIG.BODY_HEIGHT / 2;

    if (feetY > deathY) {
      // Instant KO
      fighter.health = 0;
      fighter.createRagdoll(0, 200, 2000);
      fighter.enterState('KO');
      fighter.canAct = false;
      SoundManager.ko();
      this.cameras.main.shake(200, 0.008);
    }
  }

  isNearWall(fighter) {
    const stageLeft = this.mapData.stageLeft ?? GAME_CONFIG.STAGE_LEFT;
    const stageRight = this.mapData.stageRight ?? GAME_CONFIG.STAGE_RIGHT;
    return fighter.x < stageLeft + 60 || fighter.x > stageRight - 60;
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
      const isComboFinisher = attacker.state === 'COMBO_FINISHER';
      const isWallSpecial = attacker.state === 'WALL_SPECIAL';
      const isDiveKick = attacker.state === 'DIVE_KICK';
      const isComboHit = attacker.comboChain.length > 0;

      // Pass attack flags (e.g. blockPiercing, knockbackY) to takeDamage
      defender.takeDamage(attackData.damage, knockDir * attackData.knockback, {
        blockPiercing: attackData.blockPiercing || false,
        knockbackY: attackData.knockbackY || undefined,
      });

      // Hit spark at the intersection of hitbox and hurtbox (on the defender)
      const overlapX = Math.max(hitbox.x, hurtbox.x);
      const overlapX2 = Math.min(hitbox.x + hitbox.width, hurtbox.x + hurtbox.width);
      const overlapY = Math.max(hitbox.y, hurtbox.y);
      const overlapY2 = Math.min(hitbox.y + hitbox.height, hurtbox.y + hurtbox.height);
      const hitX = (overlapX + overlapX2) / 2;
      const hitY = (overlapY + overlapY2) / 2;

      // Block advantage — punish the attacker for hitting into a block
      if (wasBlocking) {
        // Don't punish attacker for combo finisher block pierce
        if (!attackData.blockPiercing) {
          attacker.onAttackBlocked(knockDir);
        }
        SoundManager.block();
      } else {
        SoundManager.hit();

        // Track wall combo hits on successful punches (not blocked)
        const isPunch = attacker.state === 'PUNCH' || attacker.state === 'CROUCH_PUNCH';
        if (isPunch) {
          attacker.registerWallComboHit();
        }

        // Hitstop on dive kick / wall special / combo hits
        if (isDiveKick) {
          attacker.applyHitstop(40);
          defender.applyHitstop(40);
          this.cameras.main.shake(100, 0.008);
          this.showDiveKickText(attacker);
        } else if (isWallSpecial) {
          attacker.applyHitstop(150);
          defender.applyHitstop(150);
          this.cameras.main.shake(300, 0.025);
          this.showWallSpecialText(attacker);
        } else if (isComboFinisher) {
          // COMBO_FINISHER non-blocked: 120ms hitstop, bigger shake, finisher VFX
          attacker.applyHitstop(120);
          defender.applyHitstop(120);
          this.cameras.main.shake(200, 0.02);
          spawnComboFinisher(this, hitX, hitY, knockDir, attacker.data.color, attacker.comboFinisherAnim);
        } else if (isComboHit) {
          // Regular combo hit: 60ms hitstop
          attacker.applyHitstop(60);
          defender.applyHitstop(60);
        }

        // Show combo counter for multi-hit chains
        if (isComboHit || isComboFinisher) {
          this.showComboText(attacker, Math.max(attacker.comboChain.length, 1));
        }
      }

      // Visual feedback - screen shake (unless finisher/wall special already shook)
      if ((!isComboFinisher && !isWallSpecial) || wasBlocking) {
        this.cameras.main.shake(100, 0.005 * attackData.damage);
      }

      this.createHitSpark(hitX, hitY, wasBlocking);
    }
  }

  showComboText(fighter, hitCount) {
    const isFinisher = fighter.comboFinisher || fighter.state === 'COMBO_FINISHER';
    const fighterColor = `#${fighter.data.color.toString(16).padStart(6, '0')}`;
    const textY = fighter.y - GAME_CONFIG.BODY_HEIGHT;

    if (isFinisher) {
      // Finisher: "COMBO!" in 44px with fighter's color + shadow glow
      const shadow = this.add.text(fighter.x + 2, textY + 2, 'COMBO!', {
        fontSize: '44px', fontFamily: 'monospace', color: '#000000', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(99).setAlpha(0.6);

      const text = this.add.text(fighter.x, textY, 'COMBO!', {
        fontSize: '44px', fontFamily: 'monospace', color: fighterColor, fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(100);

      this.tweens.add({
        targets: [text, shadow],
        y: '-=50',
        alpha: 0,
        duration: 800,
        ease: 'Power2',
        onComplete: () => { text.destroy(); shadow.destroy(); }
      });
    } else {
      // Non-finisher combo hits: yellow "X HIT"
      const text = this.add.text(fighter.x, textY, `${hitCount} HIT`, {
        fontSize: '24px', fontFamily: 'monospace', color: '#ffcc00', fontStyle: 'bold'
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
  }

  showWallSpecialText(fighter) {
    const fighterColor = `#${fighter.data.color.toString(16).padStart(6, '0')}`;
    const textY = fighter.y - GAME_CONFIG.BODY_HEIGHT;
    const name = fighter.data.wallSpecialName || 'WALL COMBO!';

    const shadow = this.add.text(fighter.x + 2, textY + 2, name, {
      fontSize: '40px', fontFamily: 'monospace', color: '#000000', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(99).setAlpha(0.6);

    const text = this.add.text(fighter.x, textY, name, {
      fontSize: '40px', fontFamily: 'monospace', color: fighterColor, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: [text, shadow],
      y: '-=60',
      alpha: 0,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => { text.destroy(); shadow.destroy(); }
    });
  }

  showDiveKickText(fighter) {
    const fighterColor = `#${fighter.data.color.toString(16).padStart(6, '0')}`;
    const textY = fighter.y - GAME_CONFIG.BODY_HEIGHT;

    const text = this.add.text(fighter.x, textY, 'DIVE!', {
      fontSize: '32px', fontFamily: 'monospace', color: fighterColor, fontStyle: 'bold'
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
    this.roundWinner = winnerIndex;
    this.roundEndTimer = 0;
    this.roundEndReady = false;

    if (winnerIndex === 0) this.p1Wins++;
    else this.p2Wins++;

    // Set fighter states
    const winner = winnerIndex === 0 ? this.fighter1 : this.fighter2;
    const loser = winnerIndex === 0 ? this.fighter2 : this.fighter1;
    winner.body.body.setVelocity(0, 0);
    winner.enterState('VICTORY');
    loser.enterState('KO');

    // KO text
    this.koText = this.add.text(640, 300, 'K.O.!', {
      fontSize: '80px', fontFamily: 'monospace', color: '#ff3333', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(200);

    SoundManager.ko();
    this.cameras.main.shake(300, 0.01);

    // "Press any button" prompt (hidden until ready)
    this.continueText = this.add.text(640, 400, 'Press any button', {
      fontSize: '22px', fontFamily: 'monospace', color: '#888888'
    }).setOrigin(0.5).setDepth(200).setAlpha(0);

    // Require all inputs to be released before accepting continue input
    this.continueInputReleased = false;
  }

  advanceFromKO() {
    if (this.koText) { this.koText.destroy(); this.koText = null; }
    if (this.continueText) { this.continueText.destroy(); this.continueText = null; }

    const winnerIndex = this.roundWinner;

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
  }

  anyInputHeld() {
    // Keyboard
    const keys = this.input.keyboard.keys;
    for (const key of keys) {
      if (key && key.isDown) return true;
    }
    // Gamepads
    const pads = this._getPads();
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      for (const btn of pad.buttons) {
        if (btn && btn.pressed) return true;
      }
    }
    return false;
  }

  checkContinueInput() {
    if (!this.continueInputReleased) {
      // Wait for all buttons/keys from the fight to be released first
      if (!this.anyInputHeld()) {
        this.continueInputReleased = true;
      }
      return false;
    }
    // Now accept a fresh press
    return this.anyInputHeld();
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
