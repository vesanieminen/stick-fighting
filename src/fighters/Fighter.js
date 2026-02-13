import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { POSES, lerpPose } from './FighterAnimations.js';
import { StickFigureRenderer } from './StickFigureRenderer.js';
import { SoundManager } from '../audio/SoundManager.js';
import {
  spawnSpeedLines, spawnDustPuff, spawnShockwave, spawnFireParticles,
  spawnFireTrail, spawnIceTrail, spawnIceCrystals, spawnLightningBolt,
  spawnElectricSparks, spawnSlashMark, spawnArmorGlow, spawnWhirlwindArcs,
  spawnChargingAura, spawnExplosionRing, spawnSmokePuff, spawnTeleportFlash,
  spawnGroundCrack,
} from '../effects/SpecialEffects.js';

const STATES = {
  IDLE: 'IDLE',
  WALK_FORWARD: 'WALK_FORWARD',
  WALK_BACKWARD: 'WALK_BACKWARD',
  JUMP: 'JUMP',
  PUNCH: 'PUNCH',
  KICK: 'KICK',
  SPECIAL: 'SPECIAL',
  BLOCK: 'BLOCK',
  HIT: 'HIT',
  KO: 'KO',
  VICTORY: 'VICTORY',
};

export class Fighter {
  constructor(scene, x, y, playerIndex, facingRight, data) {
    this.scene = scene;
    this.playerIndex = playerIndex;
    this.facingRight = facingRight;
    this.data = data;

    // State
    this.state = STATES.IDLE;
    this.maxHealth = data.maxHealth || GAME_CONFIG.MAX_HEALTH;
    this.health = this.maxHealth;
    this.stateTimer = 0;
    this.specialCooldown = 0;
    this.canAct = true;
    this.hasHit = false; // Prevents same attack hitting twice
    this.specialHitCount = 0; // For multi-hit specials (flurry)
    this.armorActive = false; // For armor smash
    this._effectPhase = 0; // Tracks which one-shot effects have fired
    this._effectTimer = 0; // Timer for periodic effects

    // Attack cooldown — prevents rapid-fire attack spam
    this.attackCooldown = 0;

    // Stale move tracking — repeated same attacks deal less damage
    this.lastAttackType = null;
    this.sameAttackCount = 0;
    this.timeSinceLastAttack = 0;

    // Physics body using a zone (no texture needed)
    // Place zone so its center is at the right height (body bottom at ground)
    this.body = scene.add.zone(x, y - GAME_CONFIG.BODY_HEIGHT / 2, GAME_CONFIG.BODY_WIDTH, GAME_CONFIG.BODY_HEIGHT);
    scene.physics.add.existing(this.body);
    this.body.body.setCollideWorldBounds(true);

    // Graphics for drawing
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(10);

    // Renderer
    this.renderer = new StickFigureRenderer(this.graphics);

    // Animation frame tracking
    this.animFrame = 0;
    this.animTimer = 0;
  }

  get x() { return this.body.x; }
  get y() { return this.body.y; }
  get isGrounded() { return this.body.body.blocked.down; }
  get specialDuration() { return this.data.specialDuration || GAME_CONFIG.SPECIAL_DURATION; }

  update(delta, input) {
    this.stateTimer += delta;
    this.animTimer += delta;
    this.specialCooldown = Math.max(0, this.specialCooldown - delta);
    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    this.timeSinceLastAttack += delta;

    // Reset stale move counter after inactivity
    if (this.timeSinceLastAttack > GAME_CONFIG.STALE_MOVE_RESET_TIME) {
      this.sameAttackCount = 0;
    }

    if (this.canAct && this.state !== STATES.KO && this.state !== STATES.VICTORY) {
      this.handleInput(input);
    }

    this.updateState(delta);
    this.draw();
  }

  handleInput(input) {
    // Can't act during attack recovery or hitstun
    if (!this.canAct) return;

    const inActionableState = [STATES.IDLE, STATES.WALK_FORWARD, STATES.WALK_BACKWARD, STATES.BLOCK].includes(this.state);
    const inAir = !this.isGrounded;

    // Attack inputs (priority over movement, requires cooldown expired)
    if ((inActionableState || (inAir && this.state === STATES.JUMP)) && this.attackCooldown <= 0) {
      if (input.special && this.specialCooldown <= 0 && this.isGrounded) {
        this.enterState(STATES.SPECIAL);
        this.specialCooldown = GAME_CONFIG.SPECIAL_COOLDOWN;
        return;
      }
      if (input.punch) {
        this.enterState(STATES.PUNCH);
        return;
      }
      if (input.kick) {
        this.enterState(STATES.KICK);
        return;
      }
    }

    // Block
    if (input.block && this.isGrounded && inActionableState) {
      if (this.state !== STATES.BLOCK) {
        this.enterState(STATES.BLOCK);
      }
      return;
    }

    // Release block
    if (this.state === STATES.BLOCK && !input.block) {
      this.enterState(STATES.IDLE);
    }

    // Jump
    if (input.jump && this.isGrounded && inActionableState) {
      this.body.body.setVelocityY(this.data.jumpVelocity);
      this.enterState(STATES.JUMP);
      return;
    }

    // Movement (only on ground in actionable states)
    if (this.state !== STATES.BLOCK && this.state !== STATES.JUMP) {
      if (input.left) {
        this.body.body.setVelocityX(-this.data.moveSpeed);
        if (this.isGrounded) {
          const movingForward = !this.facingRight;
          this.state = movingForward ? STATES.WALK_FORWARD : STATES.WALK_BACKWARD;
        }
      } else if (input.right) {
        this.body.body.setVelocityX(this.data.moveSpeed);
        if (this.isGrounded) {
          const movingForward = this.facingRight;
          this.state = movingForward ? STATES.WALK_FORWARD : STATES.WALK_BACKWARD;
        }
      } else if (this.isGrounded && inActionableState) {
        this.body.body.setVelocityX(0);
        if (this.state !== STATES.IDLE) {
          this.state = STATES.IDLE;
        }
      }
    }

    // Air movement (reduced)
    if (this.state === STATES.JUMP) {
      if (input.left) {
        this.body.body.setVelocityX(-this.data.moveSpeed * 0.7);
      } else if (input.right) {
        this.body.body.setVelocityX(this.data.moveSpeed * 0.7);
      }
    }
  }

  updateState(delta) {
    switch (this.state) {
      case STATES.PUNCH:
        if (this.stateTimer >= GAME_CONFIG.PUNCH_DURATION) {
          this.canAct = true;
          this.hasHit = false;
          this.attackCooldown = GAME_CONFIG.PUNCH_RECOVERY;
          this.enterState(STATES.IDLE);
        }
        break;

      case STATES.KICK:
        if (this.stateTimer >= GAME_CONFIG.KICK_DURATION) {
          this.canAct = true;
          this.hasHit = false;
          this.attackCooldown = GAME_CONFIG.KICK_RECOVERY;
          this.enterState(STATES.IDLE);
        }
        break;

      case STATES.SPECIAL:
        this.updateSpecial(delta);
        if (this.stateTimer >= this.specialDuration) {
          this.canAct = true;
          this.hasHit = false;
          this.specialHitCount = 0;
          this.armorActive = false;
          this._effectPhase = 0;
          this._effectTimer = 0;
          this.attackCooldown = GAME_CONFIG.SPECIAL_RECOVERY;
          this.body.body.setVelocityX(0);
          this.enterState(STATES.IDLE);
        }
        break;

      case STATES.HIT:
        if (this.stateTimer >= GAME_CONFIG.HITSTUN_DURATION) {
          this.canAct = true;
          this.enterState(STATES.IDLE);
        }
        break;

      case STATES.JUMP:
        if (this.isGrounded && this.stateTimer > 100) {
          this.body.body.setVelocityX(0);
          this.enterState(STATES.IDLE);
        }
        break;

      case STATES.KO:
        // KO falling animation
        if (this.stateTimer < 500) {
          const dir = this.facingRight ? -1 : 1;
          this.body.body.setVelocityX(dir * 100);
        } else {
          this.body.body.setVelocityX(0);
        }
        break;
    }
  }

  updateSpecial(delta) {
    const t = this.stateTimer;
    const dur = this.specialDuration;
    const dir = this.facingRight ? 1 : -1;
    const bh = GAME_CONFIG.BODY_HEIGHT;
    const footY = this.y + bh / 2;

    // Periodic effect timer
    this._effectTimer += delta;

    switch (this.data.specialType) {
      case 'lunge':
        // Dash forward during active frames
        if (t > dur * 0.2 && t < dur * 0.7) {
          this.body.body.setVelocityX(dir * 550);
          // Periodic speed lines
          if (this._effectTimer > 50) {
            this._effectTimer = 0;
            spawnSpeedLines(this.scene, this.x, this.y, dir, this.data.color, 4);
          }
        }
        // Dust puff at start
        if (this._effectPhase < 1 && t > dur * 0.15) {
          this._effectPhase = 1;
          spawnDustPuff(this.scene, this.x - dir * 20, footY);
          SoundManager.whoosh();
        }
        break;

      case 'groundPound':
        // Jump up phase
        if (t > dur * 0.05 && t < dur * 0.3) {
          this.body.body.setVelocityY(-600);
        }
        // Slam down phase
        if (t > dur * 0.4 && t < dur * 0.65) {
          this.body.body.setVelocityY(1000);
          this.body.body.setVelocityX(0);
        }
        // Dust at takeoff
        if (this._effectPhase < 1 && t > dur * 0.05) {
          this._effectPhase = 1;
          spawnDustPuff(this.scene, this.x, footY, 0x888888);
        }
        // Impact effects on landing
        if (this._effectPhase < 2 && t > dur * 0.55 && this.isGrounded) {
          this._effectPhase = 2;
          spawnShockwave(this.scene, this.x, footY, this.data.color, 100);
          spawnGroundCrack(this.scene, this.x, footY);
          spawnDustPuff(this.scene, this.x - 30, footY, 0x666666);
          spawnDustPuff(this.scene, this.x + 30, footY, 0x666666);
          this.scene.cameras.main.shake(250, 0.02);
          SoundManager.heavyImpact();
        }
        break;

      case 'teleport':
        // Smoke at origin before teleport
        if (this._effectPhase < 1 && t > dur * 0.15) {
          this._effectPhase = 1;
          spawnSmokePuff(this.scene, this.x, this.y, this.data.color);
          SoundManager.warp();
        }
        // Teleport behind opponent
        if (t > dur * 0.3 && t < dur * 0.35 && this.opponent) {
          const behindX = this.opponent.x + (this.opponent.facingRight ? -70 : 70);
          this.body.setPosition(
            Phaser.Math.Clamp(behindX, GAME_CONFIG.STAGE_LEFT + 30, GAME_CONFIG.STAGE_RIGHT - 30),
            this.body.y
          );
        }
        // Flash at destination
        if (this._effectPhase < 2 && t > dur * 0.35) {
          this._effectPhase = 2;
          spawnTeleportFlash(this.scene, this.x, this.y, this.data.color);
        }
        break;

      case 'uppercut':
        // Launch upward with hit
        if (t > dur * 0.2 && t < dur * 0.5) {
          this.body.body.setVelocityY(-700);
          this.body.body.setVelocityX(dir * 180);
          // Fire trail
          if (this._effectTimer > 40) {
            this._effectTimer = 0;
            spawnFireTrail(this.scene, this.x, this.y + 20, dir, this.data.color);
          }
        }
        // Fire burst at start
        if (this._effectPhase < 1 && t > dur * 0.15) {
          this._effectPhase = 1;
          spawnFireParticles(this.scene, this.x + dir * 20, this.y, this.data.color, 10);
          SoundManager.risingAttack();
        }
        break;

      case 'slide':
        // Slide along the ground
        if (t > dur * 0.15 && t < dur * 0.7) {
          this.body.body.setVelocityX(dir * 600);
          // Ice trail
          if (this._effectTimer > 60) {
            this._effectTimer = 0;
            spawnIceTrail(this.scene, this.x, footY, dir, this.data.color);
          }
        }
        // Ice burst at start
        if (this._effectPhase < 1 && t > dur * 0.1) {
          this._effectPhase = 1;
          spawnIceCrystals(this.scene, this.x, footY, this.data.color);
          SoundManager.iceSlide();
        }
        break;

      case 'lightningDrop':
        // Hop up
        if (t < dur * 0.25) {
          this.body.body.setVelocityY(-700);
          this.body.body.setVelocityX(dir * 120);
          // Electric sparks while rising
          if (this._effectTimer > 60) {
            this._effectTimer = 0;
            spawnElectricSparks(this.scene, this.x, this.y, this.data.color, 4);
          }
        }
        // Slam down
        if (t > dur * 0.35 && t < dur * 0.65) {
          this.body.body.setVelocityY(1000);
          this.body.body.setVelocityX(0);
        }
        // Lightning bolt + sparks on impact
        if (this._effectPhase < 1 && t > dur * 0.5 && this.isGrounded) {
          this._effectPhase = 1;
          spawnLightningBolt(this.scene, this.x, 0, this.x, footY, this.data.color);
          spawnElectricSparks(this.scene, this.x, footY, this.data.color, 12);
          spawnShockwave(this.scene, this.x, footY, this.data.color, 60);
          this.scene.cameras.main.shake(150, 0.012);
          SoundManager.electric();
        }
        break;

      case 'flurry':
        // Rapid multi-hit: reset hasHit periodically
        if (t > dur * 0.12 && t < dur * 0.8) {
          this.body.body.setVelocityX(dir * 280);
          const hitInterval = (dur * 0.68) / (this.data.specialHits || 4);
          const elapsed = t - dur * 0.12;
          const hitNum = Math.floor(elapsed / hitInterval);
          if (hitNum > this.specialHitCount) {
            this.specialHitCount = hitNum;
            this.hasHit = false; // Allow next hit
            // Slash mark per hit
            spawnSlashMark(this.scene, this.x, this.y, dir, this.data.color);
            SoundManager.flurryHit();
          }
        }
        break;

      case 'armorSmash':
        // Armor active during windup
        if (t < dur * 0.5) {
          this.armorActive = true;
          // Pulsing armor glow
          if (this._effectTimer > 100) {
            this._effectTimer = 0;
            spawnArmorGlow(this.scene, this.x, this.y, this.data.color, 45);
          }
        } else {
          this.armorActive = false;
        }
        // Forward smash
        if (t > dur * 0.45 && t < dur * 0.65) {
          this.body.body.setVelocityX(dir * 400);
        }
        // Impact effects
        if (this._effectPhase < 1 && t > dur * 0.5) {
          this._effectPhase = 1;
          spawnGroundCrack(this.scene, this.x + dir * 40, footY, this.data.color);
          spawnDustPuff(this.scene, this.x + dir * 40, footY, 0x888888);
          this.scene.cameras.main.shake(150, 0.01);
          SoundManager.heavyImpact();
        }
        break;

      case 'whirlwind':
        // Spin with wide range — slight forward movement
        if (t > dur * 0.1 && t < dur * 0.75) {
          this.body.body.setVelocityX(dir * 180);
          // Spinning arcs
          if (this._effectTimer > 50) {
            this._effectTimer = 0;
            const rotation = (t / dur) * Math.PI * 8;
            spawnWhirlwindArcs(this.scene, this.x, this.y, rotation, this.data.color);
          }
        }
        // Initial whoosh
        if (this._effectPhase < 1 && t > dur * 0.1) {
          this._effectPhase = 1;
          SoundManager.whoosh();
        }
        break;

      case 'explosion':
        // Charge phase — growing aura
        if (t < dur * 0.55) {
          this.body.body.setVelocityX(0); // Stand still while charging
          const chargeProgress = t / (dur * 0.55);
          if (this._effectTimer > 60) {
            this._effectTimer = 0;
            spawnChargingAura(this.scene, this.x, this.y, this.data.color, 10 + chargeProgress * 35);
          }
        }
        // Explosion burst
        if (this._effectPhase < 1 && t > dur * 0.55) {
          this._effectPhase = 1;
          spawnExplosionRing(this.scene, this.x, this.y, this.data.color, 130);
          this.scene.cameras.main.shake(300, 0.025);
          SoundManager.boom();
        }
        // Self-knockback after explosion
        if (t > dur * 0.6 && t < dur * 0.7) {
          this.body.body.setVelocityX(-dir * 150);
        }
        break;
    }
  }

  enterState(newState) {
    this.state = newState;
    this.stateTimer = 0;
    this.animFrame = 0;
    this.animTimer = 0;

    // Sound effects on state entry
    switch (newState) {
      case STATES.PUNCH: SoundManager.punch(); break;
      case STATES.KICK: SoundManager.kick(); break;
      case STATES.SPECIAL: SoundManager.special(); break;
      case STATES.JUMP: SoundManager.jump(); break;
    }

    if ([STATES.PUNCH, STATES.KICK, STATES.SPECIAL].includes(newState)) {
      this.canAct = false;
      this.hasHit = false;

      // Track stale moves
      const attackType = newState;
      if (attackType === this.lastAttackType && this.timeSinceLastAttack < GAME_CONFIG.STALE_MOVE_RESET_TIME) {
        this.sameAttackCount++;
      } else {
        this.sameAttackCount = 1;
      }
      this.lastAttackType = attackType;
      this.timeSinceLastAttack = 0;
    }

    if (newState === STATES.SPECIAL) {
      this._effectPhase = 0;
      this._effectTimer = 0;
    }

    if (newState === STATES.HIT) {
      this.canAct = false;
    }

    // Stop sliding when blocking
    if (newState === STATES.BLOCK) {
      this.body.body.setVelocityX(0);
    }
  }

  isAttacking() {
    return [STATES.PUNCH, STATES.KICK, STATES.SPECIAL].includes(this.state);
  }

  isOnActiveFrame() {
    if (!this.isAttacking()) return false;

    let duration, activeStart, activeEnd;
    switch (this.state) {
      case STATES.PUNCH:
        duration = GAME_CONFIG.PUNCH_DURATION;
        activeStart = duration * 0.3;
        activeEnd = duration * 0.6;
        break;
      case STATES.KICK:
        duration = GAME_CONFIG.KICK_DURATION;
        activeStart = duration * 0.25;
        activeEnd = duration * 0.6;
        break;
      case STATES.SPECIAL:
        duration = this.specialDuration;
        // Per-type active frame windows
        switch (this.data.specialType) {
          case 'lunge':        activeStart = duration * 0.25; activeEnd = duration * 0.65; break;
          case 'groundPound':  activeStart = duration * 0.50; activeEnd = duration * 0.70; break;
          case 'teleport':     activeStart = duration * 0.40; activeEnd = duration * 0.70; break;
          case 'uppercut':     activeStart = duration * 0.20; activeEnd = duration * 0.50; break;
          case 'slide':        activeStart = duration * 0.20; activeEnd = duration * 0.70; break;
          case 'lightningDrop':activeStart = duration * 0.45; activeEnd = duration * 0.65; break;
          case 'flurry':       activeStart = duration * 0.12; activeEnd = duration * 0.80; break;
          case 'armorSmash':   activeStart = duration * 0.50; activeEnd = duration * 0.70; break;
          case 'whirlwind':    activeStart = duration * 0.12; activeEnd = duration * 0.75; break;
          case 'explosion':    activeStart = duration * 0.55; activeEnd = duration * 0.75; break;
          default:             activeStart = duration * 0.20; activeEnd = duration * 0.60;
        }
        break;
      default:
        return false;
    }

    return this.stateTimer >= activeStart && this.stateTimer <= activeEnd;
  }

  getStaleDamageMultiplier() {
    if (this.sameAttackCount <= 1) return 1;
    const penalty = GAME_CONFIG.STALE_MOVE_PENALTY * (this.sameAttackCount - 1);
    return Math.max(GAME_CONFIG.STALE_MOVE_MIN, 1 - penalty);
  }

  getAttackData() {
    const stale = this.getStaleDamageMultiplier();
    switch (this.state) {
      case STATES.PUNCH:
        return {
          damage: Math.round(this.data.punchDamage * stale),
          range: this.data.punchRange,
          knockback: GAME_CONFIG.PUNCH_KNOCKBACK,
        };
      case STATES.KICK:
        return {
          damage: Math.round(this.data.kickDamage * stale),
          range: this.data.kickRange,
          knockback: GAME_CONFIG.KICK_KNOCKBACK,
        };
      case STATES.SPECIAL:
        return {
          damage: Math.round(this.data.specialDamage * stale),
          range: this.data.specialRange,
          knockback: GAME_CONFIG.SPECIAL_KNOCKBACK,
        };
      default:
        return null;
    }
  }

  getHitboxRect() {
    const attack = this.getAttackData();
    if (!attack) return null;

    const dir = this.facingRight ? 1 : -1;
    const bx = this.x;
    const by = this.y;

    // Special moves with area-of-effect hitboxes (hit both sides)
    if (this.state === STATES.SPECIAL) {
      switch (this.data.specialType) {
        case 'explosion':
          // Large circle-like area centered on fighter
          return new Phaser.Geom.Rectangle(
            bx - attack.range / 2, by - attack.range / 3,
            attack.range, attack.range * 0.66
          );
        case 'groundPound':
          // Wide area on ground around fighter
          return new Phaser.Geom.Rectangle(
            bx - attack.range / 2, by - 20,
            attack.range, 60
          );
        case 'whirlwind':
          // Wide spin area around fighter
          return new Phaser.Geom.Rectangle(
            bx - attack.range / 2, by - 30,
            attack.range, 60
          );
      }
    }

    // Standard forward-facing hitbox (punch, kick, and forward specials)
    const hbX = dir > 0
      ? bx + GAME_CONFIG.BODY_WIDTH / 2
      : bx - GAME_CONFIG.BODY_WIDTH / 2 - attack.range;

    return new Phaser.Geom.Rectangle(hbX, by - 25, attack.range, 50);
  }

  getHurtboxRect() {
    return new Phaser.Geom.Rectangle(
      this.x - GAME_CONFIG.BODY_WIDTH / 2,
      this.y - GAME_CONFIG.BODY_HEIGHT / 2,
      GAME_CONFIG.BODY_WIDTH,
      GAME_CONFIG.BODY_HEIGHT
    );
  }

  takeDamage(amount, knockbackX) {
    // Armor absorbs the hit without stun (Golem's armorSmash)
    if (this.armorActive) {
      this.health -= amount * 0.3; // Still take some chip damage
      this.health = Math.max(0, this.health);
      return;
    }

    const isBlocking = this.state === STATES.BLOCK;

    if (isBlocking) {
      this.health -= amount * (1 - GAME_CONFIG.BLOCK_DAMAGE_REDUCTION);
      this.body.body.setVelocityX(knockbackX * 0.3);
    } else {
      this.health -= amount;
      this.body.body.setVelocityX(knockbackX);
      this.body.body.setVelocityY(-150);
      this.enterState(STATES.HIT);
    }

    this.health = Math.max(0, this.health);

    if (this.health <= 0) {
      this.enterState(STATES.KO);
      this.canAct = false;
    }
  }

  onAttackBlocked(knockDir) {
    // Attacker gets pushed back and stunned when blocked — rewards blocking
    this.body.body.setVelocityX(-knockDir * GAME_CONFIG.BLOCK_ATTACKER_PUSHBACK);
    this.attackCooldown = GAME_CONFIG.BLOCK_ATTACKER_STUN;
    this.canAct = false;
    // Brief stun then recover
    this.scene.time.delayedCall(GAME_CONFIG.BLOCK_ATTACKER_STUN, () => {
      if (this.state !== STATES.KO) {
        this.canAct = true;
      }
    });
  }

  setFacing(facingRight) {
    this.facingRight = facingRight;
  }

  resetForRound(x) {
    this.body.setPosition(x, GAME_CONFIG.GROUND_Y - GAME_CONFIG.BODY_HEIGHT / 2);
    this.body.body.setVelocity(0, 0);
    this.health = this.maxHealth;
    this.state = STATES.IDLE;
    this.stateTimer = 0;
    this.specialCooldown = 0;
    this.canAct = true;
    this.hasHit = false;
    this.specialHitCount = 0;
    this.armorActive = false;
    this._effectPhase = 0;
    this._effectTimer = 0;
    this.attackCooldown = 0;
    this.lastAttackType = null;
    this.sameAttackCount = 0;
    this.timeSinceLastAttack = 0;
  }

  draw() {
    const poses = POSES[this.state];
    if (!poses) return;

    let pose;
    const frameCount = poses.length;

    if (frameCount === 1) {
      pose = poses[0];
    } else {
      // Calculate frame duration based on state
      let totalDuration;
      let looping = false;
      switch (this.state) {
        case STATES.PUNCH: totalDuration = GAME_CONFIG.PUNCH_DURATION; break;
        case STATES.KICK: totalDuration = GAME_CONFIG.KICK_DURATION; break;
        case STATES.SPECIAL: totalDuration = this.specialDuration; break;
        case STATES.KO: totalDuration = 800; break;
        case STATES.JUMP: totalDuration = 600; break;
        case STATES.HIT: totalDuration = GAME_CONFIG.HITSTUN_DURATION; break;
        case STATES.IDLE: totalDuration = 800; looping = true; break;
        case STATES.WALK_FORWARD: totalDuration = 400; looping = true; break;
        case STATES.WALK_BACKWARD: totalDuration = 450; looping = true; break;
        case STATES.VICTORY: totalDuration = 900; looping = true; break;
        default: totalDuration = 400; break;
      }

      const timer = looping ? (this.stateTimer % totalDuration) : this.stateTimer;
      const frameDuration = totalDuration / frameCount;
      const currentFrame = looping
        ? Math.floor(timer / frameDuration) % frameCount
        : Math.min(Math.floor(timer / frameDuration), frameCount - 1);

      // Interpolate between frames for smoothness
      const nextFrame = looping
        ? (currentFrame + 1) % frameCount
        : Math.min(currentFrame + 1, frameCount - 1);
      const t = (timer % frameDuration) / frameDuration;

      if (currentFrame === nextFrame || this.state === STATES.KO) {
        pose = poses[currentFrame];
      } else {
        pose = lerpPose(poses[currentFrame], poses[nextFrame], t);
      }
    }

    // Draw the stick figure: hip positioned so feet land at body bottom
    const drawX = this.x;
    const drawY = this.y + GAME_CONFIG.BODY_HEIGHT / 2 - 60;
    const showGhost = this.isAttacking();

    this.renderer.draw(drawX, drawY, pose, this.facingRight, this.data.color, showGhost);
  }

  destroy() {
    this.graphics.destroy();
    this.body.destroy();
  }
}
