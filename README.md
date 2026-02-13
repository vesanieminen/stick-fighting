# Stick Fighter

A local multiplayer 2D fighting game built with Phaser 3. Play as stick figures in best-of-3 rounds!

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Opens at [http://localhost:8080](http://localhost:8080).

## Production Build

```bash
npm run build
npm run preview
```

The built files are output to `dist/`.

## Controls

| Action  | Player 1 (Keyboard) | Player 2 (Keyboard) | Gamepad        |
|---------|----------------------|----------------------|----------------|
| Move    | A / D                | Left / Right Arrow   | D-pad / Stick  |
| Jump    | W                    | Up Arrow             | A button       |
| Block   | S                    | Down Arrow           | LB / RB        |
| Punch   | J                    | , (comma)            | X button       |
| Kick    | K                    | . (period)           | Y button       |
| Special | L                    | / (slash)            | B button       |

Both players can use gamepads. The first gamepad connected maps to P1, the second to P2.

## Game Mechanics

- **Punch** — fast, short range, light damage
- **Kick** — slower, longer range, heavier damage
- **Special** — high damage with knockback, 3-second cooldown
- **Block** — hold to reduce incoming damage by 80%
- Best of 3 rounds wins the match
