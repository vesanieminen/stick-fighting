export const GAME_CONFIG = {
  // Arena
  GROUND_Y: 620,
  STAGE_LEFT: 50,
  STAGE_RIGHT: 1230,

  // Fighter defaults
  MOVE_SPEED: 300,
  JUMP_VELOCITY: -650,
  MAX_HEALTH: 100,

  // Punch (light attack)
  PUNCH_DAMAGE: 8,
  PUNCH_RANGE: 60,
  PUNCH_DURATION: 250,
  PUNCH_KNOCKBACK: 200,

  // Kick (heavy attack)
  KICK_DAMAGE: 14,
  KICK_RANGE: 80,
  KICK_DURATION: 400,
  KICK_KNOCKBACK: 350,

  // Special move
  SPECIAL_DAMAGE: 22,
  SPECIAL_RANGE: 100,
  SPECIAL_DURATION: 500,
  SPECIAL_KNOCKBACK: 500,
  SPECIAL_COOLDOWN: 3000,

  // Block
  BLOCK_DAMAGE_REDUCTION: 0.8,
  BLOCK_ATTACKER_PUSHBACK: 250,  // Push attacker back when blocked
  BLOCK_ATTACKER_STUN: 300,      // Extra recovery on attacker when blocked (ms)

  // Attack recovery (ms cooldown before can attack again)
  PUNCH_RECOVERY: 180,
  KICK_RECOVERY: 120,
  SPECIAL_RECOVERY: 250,

  // Stale move scaling
  STALE_MOVE_PENALTY: 0.2,    // Damage reduction per repeated use
  STALE_MOVE_MIN: 0.4,        // Minimum damage multiplier
  STALE_MOVE_RESET_TIME: 1500, // ms without attacking to reset

  // Rounds
  ROUNDS_TO_WIN: 2,
  ROUND_START_DELAY: 2000,
  ROUND_END_DELAY: 2000,

  // Hitstun
  HITSTUN_DURATION: 250,

  // Stick figure
  HEAD_RADIUS: 14,
  LINE_WIDTH: 4,
  BODY_WIDTH: 40,
  BODY_HEIGHT: 120,
};
