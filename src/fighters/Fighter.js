import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { POSES, lerpPose, mirrorPose } from './FighterAnimations.js';
import { StickFigureRenderer } from './StickFigureRenderer.js';
import { RagdollPhysics } from './RagdollPhysics.js';
import { SoundManager } from '../audio/SoundManager.js';
import {
  spawnSpeedLines, spawnDustPuff, spawnShockwave, spawnFireParticles,
  spawnFireTrail, spawnIceTrail, spawnIceCrystals, spawnLightningBolt,
  spawnElectricSparks, spawnSlashMark, spawnArmorGlow, spawnWhirlwindArcs,
  spawnChargingAura, spawnExplosionRing, spawnSmokePuff, spawnTeleportFlash,
  spawnGroundCrack, spawnComboFinisher, spawnWallImpact,
  spawnDiveKickTrail, spawnDiveKickLanding,
} from '../effects/SpecialEffects.js';

const STATES = {
  IDLE: 'IDLE',
  WALK_FORWARD: 'WALK_FORWARD',
  WALK_BACKWARD: 'WALK_BACKWARD',
  JUMP: 'JUMP',
  DOUBLE_JUMP: 'DOUBLE_JUMP',
  PUNCH: 'PUNCH',
  KICK: 'KICK',
  DIVE_KICK: 'DIVE_KICK',
  SPECIAL: 'SPECIAL',
  COMBO_FINISHER: 'COMBO_FINISHER',
  WALL_SPECIAL: 'WALL_SPECIAL',
  BLOCK: 'BLOCK',
  CROUCH: 'CROUCH',
  CROUCH_PUNCH: 'CROUCH_PUNCH',
  CROUCH_KICK: 'CROUCH_KICK',
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
    this.hasDoubleJumped = false; // One double jump per air time
    this.doubleJumpDir = 0; // 0=neutral, 1=forward, -1=backward
    this._effectPhase = 0; // Tracks which one-shot effects have fired
    this._effectTimer = 0; // Timer for periodic effects

    // Wall combo tracking
    this.wallComboHits = 0;
    this.wallComboTimer = 0;
    this.opponentNearWallFn = null; // Set by FightScene

    // Attack cooldown — prevents rapid-fire attack spam
    this.attackCooldown = 0;

    // Alternating limb — toggles which arm/leg leads on repeated attacks
    this.attackAlternate = false;

    // Stale move tracking — repeated same attacks deal less damage
    this.lastAttackType = null;
    this.sameAttackCount = 0;
    this.timeSinceLastAttack = 0;

    // Combo system
    this.comboBuffer = null;      // Buffered next input during cancel window
    this.comboChain = [];         // Sequence of attacks performed so far
    this.comboTimer = 0;          // Time since last combo hit
    this.comboDamageScale = 1.0;  // Current combo step damage multiplier
    this.comboDurationScale = 1.0; // Current combo step duration multiplier
    this.comboFinisher = false;   // Whether current hit is a finisher
    this.comboFinisherAnim = null; // 'strike' or 'launch'

    // Hitstop
    this.hitstopTimer = 0;

    // Ragdoll (set on KO)
    this.ragdoll = null;

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
  get isCrouching() { return [STATES.CROUCH, STATES.CROUCH_PUNCH, STATES.CROUCH_KICK].includes(this.state); }

  update(delta, input) {
    // Hitstop freeze — skip all processing
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= delta;
      this.body.body.setVelocity(0, 0);
      this.draw();
      return;
    }

    this.stateTimer += delta;
    this.animTimer += delta;
    this.specialCooldown = Math.max(0, this.specialCooldown - delta);
    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    this.timeSinceLastAttack += delta;

    // Reset stale move counter after inactivity
    if (this.timeSinceLastAttack > GAME_CONFIG.STALE_MOVE_RESET_TIME) {
      this.sameAttackCount = 0;
    }

    // Wall combo timer decay
    if (this.wallComboTimer > 0) {
      this.wallComboTimer -= delta;
      if (this.wallComboTimer <= 0) {
        this.wallComboHits = 0;
        this.wallComboTimer = 0;
      }
    }

    // Combo expiry — reset if not attacking for too long
    if (!this.isAttacking() && this.comboChain.length > 0) {
      this.comboTimer += delta;
      if (this.comboTimer > 500) {
        this.resetCombo();
      }
    }

    if (this.canAct && this.state !== STATES.KO && this.state !== STATES.VICTORY) {
      this.handleInput(input);
    } else if (this.state !== STATES.KO && this.state !== STATES.VICTORY) {
      // Check for combo buffering even when canAct is false
      this.handleComboBuffer(input);
    }

    this.updateState(delta);
    this.draw();
  }

  handleComboBuffer(input) {
    // Only buffer during PUNCH or KICK (not SPECIAL, not crouch attacks)
    if (this.state !== STATES.PUNCH && this.state !== STATES.KICK) return;
    if (!this.data.combos) return;

    const duration = this.getEffectiveDuration();
    const cancelWindowRatio = this.data.combos.cancelWindowRatio || 0.3;
    const cancelStart = duration * (1 - cancelWindowRatio);

    if (this.stateTimer >= cancelStart) {
      if (input.punch) {
        this.comboBuffer = 'PUNCH';
      } else if (input.kick) {
        this.comboBuffer = 'KICK';
      }
    }
  }

  handleInput(input) {
    // Can't act during attack recovery or hitstun
    if (!this.canAct) return;

    // Release block when button released
    if (this.state === STATES.BLOCK && !input.block) {
      this.enterState(STATES.IDLE);
    }

    // Release crouch when no longer pressing down
    if (this.state === STATES.CROUCH && !input.down) {
      this.enterState(STATES.IDLE);
    }

    const inActionableState = [
      STATES.IDLE, STATES.WALK_FORWARD, STATES.WALK_BACKWARD,
      STATES.BLOCK, STATES.CROUCH
    ].includes(this.state);
    const inAir = !this.isGrounded;

    const inAirAttackable = inAir && (this.state === STATES.JUMP || this.state === STATES.DOUBLE_JUMP);

    // Attack inputs (priority over movement, requires cooldown expired)
    if ((inActionableState || inAirAttackable) && this.attackCooldown <= 0) {
      // Special (standing only, grounded only)
      if (input.special && this.specialCooldown <= 0 && this.isGrounded
          && this.state !== STATES.CROUCH) {
        // Check wall combo special conditions
        if (this.wallComboHits >= 2 && this.opponentNearWallFn && this.opponentNearWallFn()) {
          this.enterState(STATES.WALL_SPECIAL);
          this.specialCooldown = GAME_CONFIG.SPECIAL_COOLDOWN;
          this.wallComboHits = 0;
          this.wallComboTimer = 0;
          return;
        }
        this.enterState(STATES.SPECIAL);
        this.specialCooldown = GAME_CONFIG.SPECIAL_COOLDOWN;
        return;
      }

      // Crouch attacks (from CROUCH state)
      if (this.state === STATES.CROUCH) {
        if (input.punch) {
          this.enterState(STATES.CROUCH_PUNCH);
          return;
        }
        if (input.kick) {
          this.enterState(STATES.CROUCH_KICK);
          return;
        }
      }

      // Air attacks: kick becomes dive kick, punch stays normal
      if (inAirAttackable) {
        if (input.kick) {
          this.enterState(STATES.DIVE_KICK);
          return;
        }
        if (input.punch) {
          this.enterState(STATES.PUNCH);
          return;
        }
      }

      // Standing attacks (from any non-crouch actionable state)
      if (this.state !== STATES.CROUCH && !inAirAttackable) {
        if (input.punch) {
          this.enterState(STATES.PUNCH);
          return;
        }
        if (input.kick) {
          this.enterState(STATES.KICK);
          return;
        }
      }
    }

    // Block (dedicated button, grounded, actionable)
    if (input.block && this.isGrounded && inActionableState) {
      if (this.state !== STATES.BLOCK) {
        this.enterState(STATES.BLOCK);
      }
      this.body.body.setVelocityX(0);
      return;
    }

    // Crouch (down, grounded, actionable)
    if (input.down && this.isGrounded && inActionableState) {
      if (this.state !== STATES.CROUCH) {
        this.enterState(STATES.CROUCH);
      }
      this.body.body.setVelocityX(0);
      return;
    }

    // Jump
    if (input.jump && this.isGrounded && inActionableState) {
      this.body.body.setVelocityY(this.data.jumpVelocity);
      this.enterState(STATES.JUMP);
      return;
    }

    // Double jump (from JUMP only, once per air time)
    if (input.jump && !this.hasDoubleJumped && this.state === STATES.JUMP && !this.isGrounded) {
      this.hasDoubleJumped = true;
      this.body.body.setVelocityY(this.data.jumpVelocity * 0.85);
      // Determine direction: forward, backward, or neutral
      const dir = this.facingRight ? 1 : -1;
      if ((input.right && dir > 0) || (input.left && dir < 0)) {
        this.doubleJumpDir = 1; // forward
      } else if ((input.left && dir > 0) || (input.right && dir < 0)) {
        this.doubleJumpDir = -1; // backward
      } else {
        this.doubleJumpDir = 0; // neutral — defaults to forward anim
      }
      this.enterState(STATES.DOUBLE_JUMP);
      return;
    }

    // Movement (only on ground in actionable states, never during attacks or crouch)
    if (this.state !== STATES.BLOCK && this.state !== STATES.CROUCH
        && this.state !== STATES.JUMP && this.state !== STATES.DOUBLE_JUMP
        && !this.isAttacking()) {
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
    if (this.state === STATES.JUMP || this.state === STATES.DOUBLE_JUMP) {
      if (input.left) {
        this.body.body.setVelocityX(-this.data.moveSpeed * 0.7);
      } else if (input.right) {
        this.body.body.setVelocityX(this.data.moveSpeed * 0.7);
      }
    }
  }

  getStateDuration(state) {
    switch (state || this.state) {
      case STATES.PUNCH: case STATES.CROUCH_PUNCH: return GAME_CONFIG.PUNCH_DURATION;
      case STATES.KICK: case STATES.CROUCH_KICK: return GAME_CONFIG.KICK_DURATION;
      case STATES.SPECIAL: return this.specialDuration;
      case STATES.WALL_SPECIAL: return 600;
      case STATES.COMBO_FINISHER: return 450;
      case STATES.DIVE_KICK: return 0; // No fixed duration — ends on landing
      default: return 0;
    }
  }

  getEffectiveDuration() {
    const base = this.getStateDuration(this.state);
    if (this.state === STATES.PUNCH || this.state === STATES.KICK) {
      return base * this.comboDurationScale;
    }
    return base;
  }

  updateState(delta) {
    switch (this.state) {
      case STATES.PUNCH: {
        const dur = this.getEffectiveDuration();
        if (this.stateTimer >= dur) {
          this.canAct = true;
          this.hasHit = false;
          this.resolveComboOrIdle('PUNCH', GAME_CONFIG.PUNCH_RECOVERY);
        }
        break;
      }

      case STATES.KICK: {
        const dur = this.getEffectiveDuration();
        if (this.stateTimer >= dur) {
          this.canAct = true;
          this.hasHit = false;
          this.resolveComboOrIdle('KICK', GAME_CONFIG.KICK_RECOVERY);
        }
        break;
      }

      case STATES.CROUCH_PUNCH:
        if (this.stateTimer >= GAME_CONFIG.PUNCH_DURATION) {
          this.canAct = true;
          this.hasHit = false;
          this.attackCooldown = GAME_CONFIG.PUNCH_RECOVERY;
          this.enterState(STATES.CROUCH);
        }
        break;

      case STATES.CROUCH_KICK:
        if (this.stateTimer >= GAME_CONFIG.KICK_DURATION) {
          this.canAct = true;
          this.hasHit = false;
          this.attackCooldown = GAME_CONFIG.KICK_RECOVERY;
          this.enterState(STATES.CROUCH);
        }
        break;

      case STATES.COMBO_FINISHER: {
        const finDur = 450;
        const dir = this.facingRight ? 1 : -1;
        const progress = this.stateTimer / finDur;

        // Forward lunge during 20%-50% of duration
        if (progress >= 0.2 && progress <= 0.5) {
          this.body.body.setVelocityX(dir * 350);
        } else if (progress > 0.5) {
          this.body.body.setVelocityX(0);
        }

        // VFX trigger at 25%
        if (this._effectPhase < 1 && progress >= 0.25) {
          this._effectPhase = 1;
          spawnComboFinisher(this.scene, this.x + dir * 40, this.y, dir, this.data.color, this.comboFinisherAnim);
          SoundManager.heavyImpact();
        }

        // On finish
        if (this.stateTimer >= finDur) {
          this.canAct = true;
          this.hasHit = false;
          this.resetCombo();
          this.attackCooldown = GAME_CONFIG.SPECIAL_RECOVERY;
          this.body.body.setVelocityX(0);
          this.enterState(STATES.IDLE);
        }
        break;
      }

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

      case STATES.WALL_SPECIAL:
        this.updateWallSpecial(delta);
        if (this.stateTimer >= 600) {
          this.canAct = true;
          this.hasHit = false;
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
          this.hasDoubleJumped = false;
          this.body.body.setVelocityX(0);
          this.enterState(STATES.IDLE);
        }
        break;

      case STATES.DOUBLE_JUMP:
        if (this.isGrounded && this.stateTimer > 100) {
          this.hasDoubleJumped = false;
          this.body.body.setVelocityX(0);
          this.enterState(STATES.IDLE);
        }
        break;

      case STATES.DIVE_KICK: {
        const dkDir = this.facingRight ? 1 : -1;
        this.body.body.setVelocityX(dkDir * this.data.moveSpeed * 1.2);
        this.body.body.setVelocityY(600);
        // Trail VFX
        if (this._effectTimer > 40) {
          this._effectTimer = 0;
          const footY = this.y + GAME_CONFIG.BODY_HEIGHT / 2;
          spawnDiveKickTrail(this.scene, this.x, footY - 20, dkDir, this.data.color);
        }
        // Land on ground
        if (this.isGrounded && this.stateTimer > 50) {
          const footY = this.y + GAME_CONFIG.BODY_HEIGHT / 2;
          spawnDiveKickLanding(this.scene, this.x, footY, this.data.color);
          this.scene.cameras.main.shake(80, 0.005);
          this.hasDoubleJumped = false;
          this.canAct = true;
          this.hasHit = false;
          this.attackCooldown = 200; // Brief recovery on landing
          this.body.body.setVelocityX(0);
          this.enterState(STATES.IDLE);
        }
        break;
      }

      case STATES.KO:
        // Ragdoll physics replaces the old canned slide
        if (this.ragdoll) {
          this.body.body.setVelocity(0, 0);
          this.ragdoll.update(delta / 1000);
        }
        break;
    }
  }

  resolveComboOrIdle(currentAttack, recoveryTime) {
    if (this.comboBuffer && this.data.combos) {
      const candidateSequence = [...this.comboChain, currentAttack, this.comboBuffer];
      const match = this.findComboChain(candidateSequence);

      if (match) {
        const { chain, stepIndex } = match;
        // stepIndex is the index of the buffered input in the chain sequence
        this.comboChain = candidateSequence;
        this.comboTimer = 0;
        this.comboDamageScale = chain.damageScale[stepIndex] || 1.0;
        this.comboDurationScale = chain.durationScale[stepIndex] || 1.0;
        const isFinisher = chain.finisher && stepIndex === chain.sequence.length - 1;
        this.comboFinisher = isFinisher;

        // Chain into next attack with no recovery
        this.attackCooldown = 0;

        if (isFinisher && chain.finisherAnim) {
          // Enter COMBO_FINISHER state for dramatic finisher
          this.comboFinisherAnim = chain.finisherAnim;
          this.comboBuffer = null;
          this.enterState(STATES.COMBO_FINISHER);
          this.canAct = false;
          return;
        }

        const nextState = this.comboBuffer === 'PUNCH' ? STATES.PUNCH : STATES.KICK;
        this.comboBuffer = null;
        this.enterState(nextState);
        this.canAct = false;
        return;
      }
    }

    // No combo match — reset and go to idle
    this.resetCombo();
    this.attackCooldown = recoveryTime;
    this.enterState(STATES.IDLE);
  }

  findComboChain(candidateSequence) {
    if (!this.data.combos) return null;

    for (const chain of this.data.combos.chains) {
      // Check if candidateSequence is a prefix of (or equals) this chain's sequence
      if (candidateSequence.length > chain.sequence.length) continue;

      let matches = true;
      for (let i = 0; i < candidateSequence.length; i++) {
        if (candidateSequence[i] !== chain.sequence[i]) {
          matches = false;
          break;
        }
      }

      if (matches) {
        return { chain, stepIndex: candidateSequence.length - 1 };
      }
    }
    return null;
  }

  resetCombo() {
    this.comboBuffer = null;
    this.comboChain = [];
    this.comboTimer = 0;
    this.comboDamageScale = 1.0;
    this.comboDurationScale = 1.0;
    this.comboFinisher = false;
    this.comboFinisherAnim = null;
  }

  applyHitstop(ms) {
    this.hitstopTimer = ms;
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

  updateWallSpecial(delta) {
    const dur = 600;
    const t = this.stateTimer;
    const dir = this.facingRight ? 1 : -1;
    const progress = t / dur;

    this._effectTimer += delta;

    // Forward lunge during 20%-50%
    if (progress >= 0.2 && progress <= 0.5) {
      this.body.body.setVelocityX(dir * 400);
    } else if (progress > 0.5) {
      this.body.body.setVelocityX(0);
    }

    // VFX at 25% — combo finisher strike effect
    if (this._effectPhase < 1 && progress >= 0.25) {
      this._effectPhase = 1;
      spawnComboFinisher(this.scene, this.x + dir * 40, this.y, dir, this.data.color, 'strike');
      SoundManager.heavyImpact();
    }

    // Wall impact VFX at 55% (when hit connects near wall)
    if (this._effectPhase < 2 && progress >= 0.55) {
      this._effectPhase = 2;
      // Determine which wall the opponent is near
      const wallX = this.opponent
        ? (this.opponent.x < GAME_CONFIG.STAGE_LEFT + 60 ? GAME_CONFIG.STAGE_LEFT : GAME_CONFIG.STAGE_RIGHT)
        : (this.x + dir * 100);
      spawnWallImpact(this.scene, wallX, this.y, this.data.color, this.data.wallSpecialType);
      this.scene.cameras.main.shake(250, 0.02);
    }
  }

  registerWallComboHit() {
    this.wallComboHits++;
    this.wallComboTimer = 1200;
  }

  enterState(newState) {
    this.state = newState;
    this.stateTimer = 0;
    this.animFrame = 0;
    this.animTimer = 0;

    // Sound effects on state entry
    switch (newState) {
      case STATES.PUNCH: case STATES.CROUCH_PUNCH: SoundManager.punch(); break;
      case STATES.KICK: case STATES.CROUCH_KICK: SoundManager.kick(); break;
      case STATES.DIVE_KICK: SoundManager.kick(); break;
      case STATES.SPECIAL: SoundManager.special(); break;
      case STATES.WALL_SPECIAL: SoundManager.special(); break;
      case STATES.COMBO_FINISHER: SoundManager.special(); break;
      case STATES.JUMP: SoundManager.jump(); break;
      case STATES.DOUBLE_JUMP: SoundManager.jump(); break;
    }

    if ([STATES.PUNCH, STATES.KICK, STATES.DIVE_KICK, STATES.SPECIAL, STATES.WALL_SPECIAL, STATES.COMBO_FINISHER, STATES.CROUCH_PUNCH, STATES.CROUCH_KICK].includes(newState)) {
      this.canAct = false;
      this.hasHit = false;

      // Toggle alternating limb for punch/kick
      if ([STATES.PUNCH, STATES.KICK, STATES.CROUCH_PUNCH, STATES.CROUCH_KICK].includes(newState)) {
        this.attackAlternate = !this.attackAlternate;
      }

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

    if (newState === STATES.SPECIAL || newState === STATES.WALL_SPECIAL || newState === STATES.COMBO_FINISHER || newState === STATES.DIVE_KICK) {
      this._effectPhase = 0;
      this._effectTimer = 0;
    }

    if (newState === STATES.DOUBLE_JUMP) {
      this.canAct = true; // Somersault can be cancelled into attacks
    }

    if (newState === STATES.HIT) {
      this.canAct = false;
      this.resetCombo(); // Getting hit resets combo
    }

    // Stop sliding when blocking or crouching
    if (newState === STATES.BLOCK || newState === STATES.CROUCH) {
      this.body.body.setVelocityX(0);
    }
  }

  isAttacking() {
    return [STATES.PUNCH, STATES.KICK, STATES.DIVE_KICK, STATES.SPECIAL, STATES.WALL_SPECIAL, STATES.COMBO_FINISHER, STATES.CROUCH_PUNCH, STATES.CROUCH_KICK].includes(this.state);
  }

  isOnActiveFrame() {
    if (!this.isAttacking()) return false;

    let duration, activeStart, activeEnd;
    switch (this.state) {
      case STATES.PUNCH:
      case STATES.CROUCH_PUNCH:
        duration = this.state === STATES.PUNCH ? this.getEffectiveDuration() : GAME_CONFIG.PUNCH_DURATION;
        activeStart = duration * 0.3;
        activeEnd = duration * 0.6;
        break;
      case STATES.KICK:
      case STATES.CROUCH_KICK:
        duration = this.state === STATES.KICK ? this.getEffectiveDuration() : GAME_CONFIG.KICK_DURATION;
        activeStart = duration * 0.25;
        activeEnd = duration * 0.6;
        break;
      case STATES.COMBO_FINISHER:
        duration = 450;
        activeStart = duration * 0.25;
        activeEnd = duration * 0.55;
        break;
      case STATES.DIVE_KICK:
        // Always active after 50ms until landing
        return this.stateTimer > 50;
      case STATES.WALL_SPECIAL:
        duration = 600;
        activeStart = duration * 0.30;
        activeEnd = duration * 0.60;
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
    const comboScale = this.comboDamageScale;
    const finisherKnockbackScale = this.comboFinisher ? 1.5 : 1.0;

    switch (this.state) {
      case STATES.PUNCH:
        return {
          damage: Math.round(this.data.punchDamage * stale * comboScale),
          range: this.data.punchRange,
          knockback: GAME_CONFIG.PUNCH_KNOCKBACK * finisherKnockbackScale,
          isCrouchAttack: false,
        };
      case STATES.KICK:
        return {
          damage: Math.round(this.data.kickDamage * stale * comboScale),
          range: this.data.kickRange,
          knockback: GAME_CONFIG.KICK_KNOCKBACK * finisherKnockbackScale,
          isCrouchAttack: false,
        };
      case STATES.DIVE_KICK:
        return {
          damage: Math.round(this.data.kickDamage * 1.2 * stale),
          range: this.data.kickRange + 10,
          knockback: GAME_CONFIG.KICK_KNOCKBACK * 1.3,
          isCrouchAttack: false,
        };
      case STATES.COMBO_FINISHER:
        return {
          damage: Math.round(this.data.kickDamage * comboScale),
          range: Math.max(this.data.punchRange, this.data.kickRange) + 15,
          knockback: GAME_CONFIG.SPECIAL_KNOCKBACK,
          isCrouchAttack: false,
          blockPiercing: true,
        };
      case STATES.WALL_SPECIAL:
        return {
          damage: Math.round(this.data.specialDamage * 1.3),
          range: this.data.specialRange + 20,
          knockback: GAME_CONFIG.SPECIAL_KNOCKBACK,
          knockbackY: -400,
          isCrouchAttack: false,
          blockPiercing: true,
        };
      case STATES.SPECIAL:
        return {
          damage: Math.round(this.data.specialDamage * stale),
          range: this.data.specialRange,
          knockback: GAME_CONFIG.SPECIAL_KNOCKBACK,
          isCrouchAttack: false,
        };
      case STATES.CROUCH_PUNCH:
        return {
          damage: Math.round(this.data.punchDamage * stale),
          range: this.data.punchRange,
          knockback: GAME_CONFIG.PUNCH_KNOCKBACK,
          isCrouchAttack: true,
        };
      case STATES.CROUCH_KICK:
        return {
          damage: Math.round(this.data.kickDamage * stale),
          range: this.data.kickRange,
          knockback: GAME_CONFIG.KICK_KNOCKBACK,
          isCrouchAttack: true,
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

    const bodyH = GAME_CONFIG.BODY_HEIGHT;

    // Special moves with area-of-effect hitboxes (hit both sides)
    if (this.state === STATES.SPECIAL) {
      switch (this.data.specialType) {
        case 'explosion':
          // Large area centered on fighter
          return new Phaser.Geom.Rectangle(
            bx - attack.range / 2, by - bodyH / 2,
            attack.range, bodyH
          );
        case 'groundPound':
          // Wide area on ground around fighter
          return new Phaser.Geom.Rectangle(
            bx - attack.range / 2, by - bodyH / 2,
            attack.range, bodyH
          );
        case 'whirlwind':
          // Wide spin area around fighter
          return new Phaser.Geom.Rectangle(
            bx - attack.range / 2, by - bodyH / 2,
            attack.range, bodyH
          );
      }
    }

    // Determine hitbox vertical region based on attack type
    const halfH = bodyH / 2;
    let hitboxY, hitboxH;
    if (attack.isCrouchAttack) {
      // Crouch attacks: bottom half of body (legs/sweep level)
      hitboxY = by;
      hitboxH = halfH;
    } else {
      // Standing attacks: top half of body (upper body level)
      // -1 prevents boundary overlap with crouch hurtbox
      hitboxY = by - halfH;
      hitboxH = halfH - 1;
    }

    // Horizontal positioning: extends forward from body edge
    const hbX = dir > 0
      ? bx + GAME_CONFIG.BODY_WIDTH / 2
      : bx - GAME_CONFIG.BODY_WIDTH / 2 - attack.range;

    return new Phaser.Geom.Rectangle(hbX, hitboxY, attack.range, hitboxH);
  }

  getHurtboxRect() {
    const bodyW = GAME_CONFIG.BODY_WIDTH;
    const bodyH = GAME_CONFIG.BODY_HEIGHT;

    if (this.isCrouching) {
      // Crouching: hurtbox is bottom half only (duck under standing attacks)
      const halfH = bodyH / 2;
      return new Phaser.Geom.Rectangle(
        this.x - bodyW / 2,
        this.y,
        bodyW,
        halfH
      );
    }

    // Standing: full body height
    return new Phaser.Geom.Rectangle(
      this.x - bodyW / 2,
      this.y - bodyH / 2,
      bodyW,
      bodyH
    );
  }

  takeDamage(amount, knockbackX, attackFlags = {}) {
    // Armor absorbs the hit without stun (Golem's armorSmash)
    if (this.armorActive) {
      this.health -= amount * 0.3; // Still take some chip damage
      this.health = Math.max(0, this.health);
      return;
    }

    const isBlocking = this.state === STATES.BLOCK;

    if (isBlocking) {
      if (attackFlags.blockPiercing) {
        // Block piercing: only 40% reduction (vs normal 80%), more pushback
        this.health -= amount * 0.6;
        this.body.body.setVelocityX(knockbackX * 0.6);
      } else {
        this.health -= amount * (1 - GAME_CONFIG.BLOCK_DAMAGE_REDUCTION);
        this.body.body.setVelocityX(knockbackX * 0.3);
      }
    } else {
      this.health -= amount;
      this.body.body.setVelocityX(knockbackX);
      this.body.body.setVelocityY(attackFlags.knockbackY || -150);
      this.enterState(STATES.HIT);
    }

    this.health = Math.max(0, this.health);

    if (this.health <= 0) {
      this.createRagdoll(knockbackX, -150, this._ragdollGroundY);
      this.enterState(STATES.KO);
      this.canAct = false;
    }
  }

  createRagdoll(knockbackVelX, knockbackVelY, groundY) {
    // Snapshot current pose to world-space positions (mirrors transformPose logic)
    let ragdollPoseKey;
    if (this.state === STATES.COMBO_FINISHER) {
      ragdollPoseKey = this.comboFinisherAnim === 'launch' ? 'COMBO_FINISHER_LAUNCH' : 'COMBO_FINISHER_STRIKE';
    } else if (this.state === STATES.WALL_SPECIAL) {
      ragdollPoseKey = 'COMBO_FINISHER_STRIKE';
    } else if (this.state === STATES.DOUBLE_JUMP) {
      ragdollPoseKey = this.doubleJumpDir < 0 ? 'DOUBLE_JUMP_BACKWARD' : 'DOUBLE_JUMP_FORWARD';
    } else if (this.state === STATES.DIVE_KICK) {
      ragdollPoseKey = 'DIVE_KICK';
    } else {
      ragdollPoseKey = this.state;
    }
    const poses = POSES[ragdollPoseKey];
    if (!poses) return;

    const pose = poses[0]; // Use first frame of current state
    const drawX = this.x;
    const drawY = this.y + GAME_CONFIG.BODY_HEIGHT / 2 - 60;
    const dir = this.facingRight ? 1 : -1;
    const v = this.data.visual || {};
    const limbScale = v.limbScale || 1.0;
    const shoulderWidth = v.shoulderWidth || 1.0;

    const worldPose = {};
    for (const joint in pose) {
      let sx = pose[joint].x * limbScale;
      const sy = pose[joint].y * limbScale;
      if (joint === 'shoulderL' || joint === 'shoulderR') {
        sx = pose[joint].x * shoulderWidth * limbScale;
      }
      worldPose[joint] = {
        x: drawX + sx * dir,
        y: drawY + sy,
      };
    }

    this.ragdoll = new RagdollPhysics(worldPose, knockbackVelX, knockbackVelY, v, groundY);
  }

  onAttackBlocked(knockDir) {
    // Attacker gets pushed back and stunned when blocked — rewards blocking
    this.body.body.setVelocityX(-knockDir * GAME_CONFIG.BLOCK_ATTACKER_PUSHBACK);
    this.attackCooldown = GAME_CONFIG.BLOCK_ATTACKER_STUN;
    this.canAct = false;
    this.resetCombo(); // Block resets combo
    // Brief stun then recover — only if the attack has already ended.
    // If still in an attack state, updateState will restore canAct when the attack finishes.
    this.scene.time.delayedCall(GAME_CONFIG.BLOCK_ATTACKER_STUN, () => {
      if (this.state !== STATES.KO && !this.isAttacking()) {
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
    this.hasDoubleJumped = false;
    this.doubleJumpDir = 0;
    this._effectPhase = 0;
    this._effectTimer = 0;
    this.attackCooldown = 0;
    this.attackAlternate = false;
    this.lastAttackType = null;
    this.sameAttackCount = 0;
    this.timeSinceLastAttack = 0;
    this.hitstopTimer = 0;
    this.wallComboHits = 0;
    this.wallComboTimer = 0;
    this.ragdoll = null;
    this.resetCombo();
  }

  draw() {
    // Ragdoll rendering during KO — skip normal pose pipeline
    if (this.state === STATES.KO && this.ragdoll) {
      const positions = this.ragdoll.getWorldPositions();
      this.renderer.drawWorldSpace(positions, this.data.color, this.data.visual || null);
      return;
    }

    let poseKey;
    if (this.state === STATES.COMBO_FINISHER) {
      poseKey = this.comboFinisherAnim === 'launch' ? 'COMBO_FINISHER_LAUNCH' : 'COMBO_FINISHER_STRIKE';
    } else if (this.state === STATES.WALL_SPECIAL) {
      poseKey = 'COMBO_FINISHER_STRIKE';
    } else if (this.state === STATES.DOUBLE_JUMP) {
      poseKey = this.doubleJumpDir < 0 ? 'DOUBLE_JUMP_BACKWARD' : 'DOUBLE_JUMP_FORWARD';
    } else if (this.state === STATES.DIVE_KICK) {
      poseKey = 'DIVE_KICK';
    } else {
      poseKey = this.state;
    }
    const poses = POSES[poseKey];
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
        case STATES.PUNCH: case STATES.CROUCH_PUNCH: totalDuration = this.getEffectiveDuration(); break;
        case STATES.KICK: case STATES.CROUCH_KICK: totalDuration = this.getEffectiveDuration(); break;
        case STATES.SPECIAL: totalDuration = this.specialDuration; break;
        case STATES.WALL_SPECIAL: totalDuration = 600; break;
        case STATES.COMBO_FINISHER: totalDuration = 450; break;
        case STATES.KO: totalDuration = 800; break;
        case STATES.JUMP: totalDuration = 600; break;
        case STATES.DOUBLE_JUMP: totalDuration = 500; break;
        case STATES.DIVE_KICK: totalDuration = 400; break;
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

    // Alternate limbs on every other attack
    const isAttackAnim = [STATES.PUNCH, STATES.KICK, STATES.CROUCH_PUNCH, STATES.CROUCH_KICK].includes(this.state);
    if (isAttackAnim && this.attackAlternate) {
      pose = mirrorPose(pose);
    }

    // Draw the stick figure: hip positioned so feet land at body bottom
    const drawX = this.x;
    const drawY = this.y + GAME_CONFIG.BODY_HEIGHT / 2 - 60;
    const showGhost = this.isAttacking();

    this.renderer.draw(drawX, drawY, pose, this.facingRight, this.data.color, showGhost, this.data.visual || null);
  }

  destroy() {
    this.ragdoll = null;
    this.graphics.destroy();
    this.body.destroy();
  }
}
