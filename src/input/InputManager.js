import Phaser from 'phaser';

const KEYBOARD_BINDINGS = {
  0: {  // Player 1
    left:    'A',
    right:   'D',
    jump:    'W',
    punch:   'J',
    kick:    'K',
    special: 'L',
    block:   'S',
  },
  1: {  // Player 2
    left:    'LEFT',
    right:   'RIGHT',
    jump:    'UP',
    punch:   'COMMA',
    kick:    'PERIOD',
    special: 'FORWARD_SLASH',
    block:   'DOWN',
  }
};

export class InputManager {
  constructor(scene, playerIndex) {
    this.scene = scene;
    this.playerIndex = playerIndex;
    this.gamepad = null;

    // Set up keyboard keys
    const bindings = KEYBOARD_BINDINGS[playerIndex];
    this.keys = {};
    for (const action in bindings) {
      this.keys[action] = scene.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes[bindings[action]]
      );
    }

    // Previous frame state for edge detection
    this.prevState = {
      jump: false,
      punch: false,
      kick: false,
      special: false,
    };

    // Listen for gamepad connection
    if (scene.input.gamepad) {
      scene.input.gamepad.on('connected', (pad) => {
        if (pad.index === playerIndex && !this.gamepad) {
          this.gamepad = pad;
        }
      });

      // Check if pad already connected
      if (scene.input.gamepad.pad1 && playerIndex === 0) {
        this.gamepad = scene.input.gamepad.pad1;
      }
      if (scene.input.gamepad.pad2 && playerIndex === 1) {
        this.gamepad = scene.input.gamepad.pad2;
      }
    }
  }

  getActions() {
    const kb = this.readKeyboard();
    const gp = this.readGamepad();

    // Merge keyboard and gamepad (OR)
    const raw = {
      left:    kb.left    || gp.left,
      right:   kb.right   || gp.right,
      jump:    kb.jump    || gp.jump,
      punch:   kb.punch   || gp.punch,
      kick:    kb.kick    || gp.kick,
      special: kb.special || gp.special,
      block:   kb.block   || gp.block,
    };

    // Edge detection for one-shot actions
    const actions = {
      left:    raw.left,
      right:   raw.right,
      jump:    raw.jump    && !this.prevState.jump,
      punch:   raw.punch   && !this.prevState.punch,
      kick:    raw.kick    && !this.prevState.kick,
      special: raw.special && !this.prevState.special,
      block:   raw.block,
    };

    this.prevState = {
      jump: raw.jump,
      punch: raw.punch,
      kick: raw.kick,
      special: raw.special,
    };

    return actions;
  }

  readKeyboard() {
    return {
      left:    this.keys.left.isDown,
      right:   this.keys.right.isDown,
      jump:    this.keys.jump.isDown,
      punch:   this.keys.punch.isDown,
      kick:    this.keys.kick.isDown,
      special: this.keys.special.isDown,
      block:   this.keys.block.isDown,
    };
  }

  readGamepad() {
    const pad = this.gamepad;
    const none = { left: false, right: false, jump: false, punch: false, kick: false, special: false, block: false };
    if (!pad || !pad.connected) return none;

    const DEADZONE = 0.3;
    const stickX = pad.leftStick ? pad.leftStick.x : 0;

    return {
      left:    pad.left || stickX < -DEADZONE,
      right:   pad.right || stickX > DEADZONE,
      jump:    pad.A,
      punch:   pad.X,
      kick:    pad.Y,
      special: pad.B,
      block:   pad.L1 || pad.R1,
    };
  }
}
