import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { POSES, lerpPose } from './FighterAnimations.js';
import { StickFigureRenderer } from './StickFigureRenderer.js';
import { SoundManager } from '../audio/SoundManager.js';

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

  update(delta, input) {
    this.stateTimer += delta;
    this.animTimer += delta;
    this.specialCooldown = Math.max(0, this.specialCooldown - delta);

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

    // Attack inputs (priority over movement)
    if (inActionableState || (inAir && this.state === STATES.JUMP)) {
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
          this.enterState(STATES.IDLE);
        }
        break;

      case STATES.KICK:
        if (this.stateTimer >= GAME_CONFIG.KICK_DURATION) {
          this.canAct = true;
          this.hasHit = false;
          this.enterState(STATES.IDLE);
        }
        break;

      case STATES.SPECIAL:
        this.updateSpecial(delta);
        if (this.stateTimer >= GAME_CONFIG.SPECIAL_DURATION) {
          this.canAct = true;
          this.hasHit = false;
          this.specialHitCount = 0;
          this.armorActive = false;
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
    const dur = GAME_CONFIG.SPECIAL_DURATION;
    const dir = this.facingRight ? 1 : -1;

    switch (this.data.specialType) {
      case 'lunge':
        // Dash forward during active frames
        if (t > dur * 0.2 && t < dur * 0.6) {
          this.body.body.setVelocityX(dir * 500);
        }
        break;

      case 'groundPound':
        // Jump up, then slam down
        if (t > dur * 0.1 && t < dur * 0.3) {
          this.body.body.setVelocityY(-500);
        } else if (t > dur * 0.4 && t < dur * 0.6) {
          this.body.body.setVelocityY(800);
        }
        break;

      case 'teleport':
        // Teleport behind opponent at the active frame
        if (t > dur * 0.3 && t < dur * 0.35 && this.opponent) {
          const behindX = this.opponent.x + (this.opponent.facingRight ? -60 : 60);
          this.body.setPosition(
            Phaser.Math.Clamp(behindX, GAME_CONFIG.STAGE_LEFT + 30, GAME_CONFIG.STAGE_RIGHT - 30),
            this.body.y
          );
        }
        break;

      case 'uppercut':
        // Launch upward with hit
        if (t > dur * 0.2 && t < dur * 0.4) {
          this.body.body.setVelocityY(-600);
          this.body.body.setVelocityX(dir * 150);
        }
        break;

      case 'slide':
        // Low slide along the ground
        if (t > dur * 0.15 && t < dur * 0.65) {
          this.body.body.setVelocityX(dir * 550);
        }
        break;

      case 'lightningDrop':
        // Hop up, then slam straight down
        if (t < dur * 0.25) {
          this.body.body.setVelocityY(-600);
          this.body.body.setVelocityX(dir * 100);
        } else if (t > dur * 0.35 && t < dur * 0.6) {
          this.body.body.setVelocityY(900);
          this.body.body.setVelocityX(0);
        }
        break;

      case 'flurry':
        // Rapid multi-hit: reset hasHit periodically
        if (t > dur * 0.15 && t < dur * 0.75) {
          this.body.body.setVelocityX(dir * 300);
          const hitInterval = (dur * 0.6) / (this.data.specialHits || 4);
          const elapsed = t - dur * 0.15;
          const hitNum = Math.floor(elapsed / hitInterval);
          if (hitNum > this.specialHitCount) {
            this.specialHitCount = hitNum;
            this.hasHit = false; // Allow next hit
          }
        }
        break;

      case 'armorSmash':
        // Armor active during windup, then big hit
        if (t < dur * 0.5) {
          this.armorActive = true;
        } else {
          this.armorActive = false;
        }
        if (t > dur * 0.4 && t < dur * 0.6) {
          this.body.body.setVelocityX(dir * 350);
        }
        break;

      case 'whirlwind':
        // Spin in place with wide range
        if (t > dur * 0.15 && t < dur * 0.7) {
          this.body.body.setVelocityX(dir * 200);
        }
        break;

      case 'explosion':
        // Charge then explode in all directions (big range)
        if (t > dur * 0.5 && t < dur * 0.6) {
          // Small knockback on self
          this.body.body.setVelocityX(-dir * 100);
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
    }

    if (newState === STATES.HIT) {
      this.canAct = false;
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
        duration = GAME_CONFIG.SPECIAL_DURATION;
        activeStart = duration * 0.2;
        activeEnd = duration * 0.6;
        break;
      default:
        return false;
    }

    return this.stateTimer >= activeStart && this.stateTimer <= activeEnd;
  }

  getAttackData() {
    switch (this.state) {
      case STATES.PUNCH:
        return {
          damage: this.data.punchDamage,
          range: this.data.punchRange,
          knockback: GAME_CONFIG.PUNCH_KNOCKBACK,
        };
      case STATES.KICK:
        return {
          damage: this.data.kickDamage,
          range: this.data.kickRange,
          knockback: GAME_CONFIG.KICK_KNOCKBACK,
        };
      case STATES.SPECIAL:
        return {
          damage: this.data.specialDamage,
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
    // Center of body vertically
    const by = this.y;

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
      switch (this.state) {
        case STATES.PUNCH: totalDuration = GAME_CONFIG.PUNCH_DURATION; break;
        case STATES.KICK: totalDuration = GAME_CONFIG.KICK_DURATION; break;
        case STATES.SPECIAL: totalDuration = GAME_CONFIG.SPECIAL_DURATION; break;
        case STATES.KO: totalDuration = 800; break;
        default: totalDuration = 400; break; // Walk cycle, idle bob
      }

      const frameDuration = totalDuration / frameCount;
      const currentFrame = Math.min(
        Math.floor(this.stateTimer / frameDuration),
        frameCount - 1
      );

      // Interpolate between frames for smoothness
      const nextFrame = Math.min(currentFrame + 1, frameCount - 1);
      const t = (this.stateTimer % frameDuration) / frameDuration;

      if (currentFrame === nextFrame || this.state === STATES.KO) {
        pose = poses[currentFrame];
      } else {
        pose = lerpPose(poses[currentFrame], poses[nextFrame], t);
      }
    }

    // Draw the stick figure: hip positioned so feet land at body bottom
    const drawX = this.x;
    const drawY = this.y + GAME_CONFIG.BODY_HEIGHT / 2 - 50;

    this.renderer.draw(drawX, drawY, pose, this.facingRight, this.data.color);
  }

  destroy() {
    this.graphics.destroy();
    this.body.destroy();
  }
}
