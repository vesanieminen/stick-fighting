import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { Fighter } from '../fighters/Fighter.js';
import { FIGHTER_DATA } from '../fighters/FighterData.js';
import { InputManager } from '../input/InputManager.js';
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

    this.createArena();
    this.createFighters();
    this.createUI();
    this.startRound();
  }

  createArena() {
    const arena = this.add.graphics();

    // Background gradient effect - darker at top, lighter at bottom
    arena.fillStyle(0x16213e, 1);
    arena.fillRect(0, 0, 1280, GAME_CONFIG.GROUND_Y);

    // Ground
    arena.fillStyle(0x333344, 1);
    arena.fillRect(0, GAME_CONFIG.GROUND_Y, 1280, 100);

    // Ground line
    arena.lineStyle(3, 0x555577, 1);
    arena.lineBetween(0, GAME_CONFIG.GROUND_Y, 1280, GAME_CONFIG.GROUND_Y);

    // Stage boundaries (subtle vertical lines)
    arena.lineStyle(1, 0x333355, 0.5);
    arena.lineBetween(GAME_CONFIG.STAGE_LEFT, 0, GAME_CONFIG.STAGE_LEFT, GAME_CONFIG.GROUND_Y);
    arena.lineBetween(GAME_CONFIG.STAGE_RIGHT, 0, GAME_CONFIG.STAGE_RIGHT, GAME_CONFIG.GROUND_Y);

    // Set physics world bounds
    this.physics.world.setBounds(
      GAME_CONFIG.STAGE_LEFT, 0,
      GAME_CONFIG.STAGE_RIGHT - GAME_CONFIG.STAGE_LEFT,
      GAME_CONFIG.GROUND_Y
    );

    // Ground collider (static body)
    this.ground = this.add.zone(640, GAME_CONFIG.GROUND_Y + 10, 1280, 20);
    this.physics.add.existing(this.ground, true); // true = static
  }

  createFighters() {
    const p1X = 350;
    const p2X = 930;

    this.fighter1 = new Fighter(this, p1X, GAME_CONFIG.GROUND_Y, 0, true, FIGHTER_DATA.balanced);
    this.fighter2 = new Fighter(this, p2X, GAME_CONFIG.GROUND_Y, 1, false, FIGHTER_DATA.heavy);

    // Ground collision
    this.physics.add.collider(this.fighter1.body, this.ground);
    this.physics.add.collider(this.fighter2.body, this.ground);

    // Fighter-to-fighter collision (they push each other)
    this.physics.add.collider(this.fighter1.body, this.fighter2.body);

    // Input managers
    this.p1Input = new InputManager(this, 0);
    this.p2Input = new InputManager(this, 1);
  }

  createUI() {
    const barWidth = 480;
    const barHeight = 28;
    const barY = 25;

    // Health bars
    this.p1HealthBar = new HealthBar(this, 50, barY, barWidth, barHeight, 0);
    this.p2HealthBar = new HealthBar(this, 750, barY, barWidth, barHeight, 1);

    // Player names
    this.add.text(50, barY - 18, FIGHTER_DATA.balanced.name, {
      fontSize: '14px', fontFamily: 'monospace', color: '#ffffff'
    });
    this.add.text(1230, barY - 18, FIGHTER_DATA.heavy.name, {
      fontSize: '14px', fontFamily: 'monospace', color: '#00ffff'
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

    // Special cooldown indicator (small text near each player)
    this.p1CooldownText = this.add.text(50, barY + barHeight + 35, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#ffcc00'
    });
    this.p2CooldownText = this.add.text(1230, barY + barHeight + 35, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#ffcc00'
    }).setOrigin(1, 0);

    // Update UI once
    this.p1HealthBar.update(GAME_CONFIG.MAX_HEALTH, GAME_CONFIG.MAX_HEALTH);
    this.p2HealthBar.update(GAME_CONFIG.MAX_HEALTH, GAME_CONFIG.MAX_HEALTH);
    this.p1RoundInd.update(this.p1Wins);
    this.p2RoundInd.update(this.p2Wins);
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
    // Always update UI
    this.p1HealthBar.update(this.fighter1.health, GAME_CONFIG.MAX_HEALTH);
    this.p2HealthBar.update(this.fighter2.health, GAME_CONFIG.MAX_HEALTH);
    this.p1RoundInd.update(this.p1Wins);
    this.p2RoundInd.update(this.p2Wins);

    // Cooldown indicators
    if (this.fighter1.specialCooldown > 0) {
      this.p1CooldownText.setText(`Special: ${Math.ceil(this.fighter1.specialCooldown / 1000)}s`);
    } else {
      this.p1CooldownText.setText('Special: READY');
    }
    if (this.fighter2.specialCooldown > 0) {
      this.p2CooldownText.setText(`Special: ${Math.ceil(this.fighter2.specialCooldown / 1000)}s`);
    } else {
      this.p2CooldownText.setText('Special: READY');
    }

    if (!this.roundActive) return;

    // Read input
    const p1Actions = this.p1Input.getActions();
    const p2Actions = this.p2Input.getActions();

    // Update fighters
    this.fighter1.update(delta, p1Actions);
    this.fighter2.update(delta, p2Actions);

    // Keep fighters facing each other
    this.updateFacing();

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

      // Sound
      if (wasBlocking) {
        SoundManager.block();
      } else {
        SoundManager.hit();
      }

      // Visual feedback - screen shake
      this.cameras.main.shake(100, 0.005 * attackData.damage);

      // Hit spark effect
      this.createHitSpark(
        (hitbox.x + hitbox.width / 2),
        (hitbox.y + hitbox.height / 2),
        wasBlocking
      );
    }
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
  }
}
