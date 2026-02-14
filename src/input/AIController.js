import { GAME_CONFIG } from '../config.js';

export class AIController {
  constructor(scene, fighter, opponent) {
    this.scene = scene;
    this.fighter = fighter;
    this.opponent = opponent;

    // Current decision state (held actions)
    this.currentActions = {
      left: false,
      right: false,
      jump: false,
      punch: false,
      kick: false,
      special: false,
      down: false,
      block: false,
    };

    // Previous frame state for edge detection
    this.prevState = {
      jump: false,
      punch: false,
      kick: false,
      special: false,
    };

    // Decision timer — make a new decision every 400-800ms
    this.decisionTimer = 0;
    this.decisionInterval = this.nextInterval();

    // Combo follow-up system
    this.comboFollowUp = null;       // 'punch' or 'kick'
    this.comboFollowUpTimer = 0;     // ms elapsed since queued
    this.comboFollowUpDelay = 0;     // target delay before firing
  }

  nextInterval() {
    return 400 + Math.random() * 400;
  }

  getActions() {
    const delta = this.scene.game.loop.delta;
    this.decisionTimer += delta;

    if (this.decisionTimer >= this.decisionInterval) {
      this.decisionTimer = 0;
      this.decisionInterval = this.nextInterval();
      this.decide();
    }

    // Process combo follow-up
    if (this.comboFollowUp && this.fighter.isAttacking()) {
      this.comboFollowUpTimer += delta;
      if (this.comboFollowUpTimer >= this.comboFollowUpDelay) {
        // Set the buffered input — edge detection will fire it
        this.currentActions[this.comboFollowUp] = true;
        this.comboFollowUp = null;
        this.comboFollowUpTimer = 0;
      }
    } else if (this.comboFollowUp && !this.fighter.isAttacking()) {
      // Fighter finished attacking before we could fire — cancel
      this.comboFollowUp = null;
      this.comboFollowUpTimer = 0;
    }

    // Edge detection for one-shot actions (same as InputManager)
    const raw = this.currentActions;
    const actions = {
      left: raw.left,
      right: raw.right,
      jump: raw.jump && !this.prevState.jump,
      punch: raw.punch && !this.prevState.punch,
      kick: raw.kick && !this.prevState.kick,
      special: raw.special && !this.prevState.special,
      down: raw.down,
      block: raw.block,
    };

    this.prevState = {
      jump: raw.jump,
      punch: raw.punch,
      kick: raw.kick,
      special: raw.special,
    };

    return actions;
  }

  decide() {
    // Reset all actions
    const a = {
      left: false,
      right: false,
      jump: false,
      punch: false,
      kick: false,
      special: false,
      down: false,
      block: false,
    };

    // 15% chance to do nothing (makes AI beatable)
    if (Math.random() < 0.15) {
      this.currentActions = a;
      return;
    }

    const myX = this.fighter.body.x;
    const oppX = this.opponent.body.x;
    const dist = Math.abs(myX - oppX);
    const facingOpp = oppX > myX; // true = opponent is to the right

    const canSpecial = this.fighter.specialCooldown <= 0;
    const oppAttacking = this.opponent.isAttacking();

    if (dist > 250) {
      // Far range — walk toward opponent, occasionally jump
      if (facingOpp) a.right = true;
      else a.left = true;

      if (Math.random() < 0.15 && this.fighter.isGrounded) {
        a.jump = true;
      }
    } else if (dist > 120) {
      // Medium range — approach or attack
      if (Math.random() < 0.6) {
        // Approach
        if (facingOpp) a.right = true;
        else a.left = true;
      } else {
        // Attack — kick has better range
        if (Math.random() < 0.65) {
          a.kick = true;
        } else {
          a.punch = true;
        }
      }

      if (Math.random() < 0.1 && this.fighter.isGrounded) {
        a.jump = true;
      }
    } else {
      // Close range — attack or defend
      if (oppAttacking && Math.random() < 0.35) {
        // Defensive reaction
        if (Math.random() < 0.6) {
          // Block
          a.block = true;
        } else {
          // Crouch (dodge standing attacks)
          a.down = true;
          // Occasionally counter-attack from crouch
          if (Math.random() < 0.4) {
            if (Math.random() < 0.5) a.punch = true;
            else a.kick = true;
          }
        }
      } else {
        // Attack
        const roll = Math.random();
        if (canSpecial && roll < 0.20) {
          a.special = true;
        } else if (roll < 0.55) {
          a.punch = true;
          this.tryQueueComboFollowUp('punch');
        } else {
          a.kick = true;
          this.tryQueueComboFollowUp('kick');
        }
      }

      // Occasionally jump at close range
      if (Math.random() < 0.08 && this.fighter.isGrounded) {
        a.jump = true;
      }
    }

    this.currentActions = a;
  }

  tryQueueComboFollowUp(initialAttack) {
    if (!this.fighter.data.combos) return;
    if (this.comboFollowUp) return; // already queued

    // 40% chance to queue a follow-up
    if (Math.random() < 0.4) {
      this.comboFollowUp = Math.random() < 0.5 ? 'punch' : 'kick';
      this.comboFollowUpTimer = 0;
      this.comboFollowUpDelay = 200 + Math.random() * 100; // 200-300ms
    }
  }
}
