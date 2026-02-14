// Verlet particle-constraint ragdoll simulation for KO animations.
// Each joint is a particle with position history (implicit velocity).
// Distance constraints keep bones connected. No external physics engine.

const GRAVITY = 1800;
const DAMPING = 0.98;
const GROUND_FRICTION = 0.85;
const BOUNCE = 0.25;
const CONSTRAINT_ITERATIONS = 5;
const DEFAULT_GROUND_Y = 620;
const STAGE_LEFT = 50;
const STAGE_RIGHT = 1230;
const SETTLE_TIME = 2000; // ms before extra damping kicks in
const SETTLE_DAMPING = 0.90;

const JOINT_NAMES = [
  'head', 'neck', 'hip',
  'shoulderL', 'shoulderR',
  'elbowL', 'elbowR',
  'handL', 'handR',
  'kneeL', 'kneeR',
  'footL', 'footR',
];

// Mass weights per joint
const MASS = {
  head: 0.6,
  neck: 1.0,
  hip: 2.0,
  shoulderL: 0.8, shoulderR: 0.8,
  elbowL: 0.8, elbowR: 0.8,
  handL: 0.5, handR: 0.5,
  kneeL: 0.8, kneeR: 0.8,
  footL: 0.5, footR: 0.5,
};

// Knockback velocity distribution (fraction of hip velocity)
const KNOCKBACK_FRAC = {
  head: 0.4,
  neck: 0.7,
  hip: 1.0,
  shoulderL: 0.6, shoulderR: 0.6,
  elbowL: 0.3, elbowR: 0.3,
  handL: 0.2, handR: 0.2,
  kneeL: 0.5, kneeR: 0.5,
  footL: 0.2, footR: 0.2,
};

// Bone connections: [jointA, jointB, stiffness]
const BONES = [
  // Spine
  ['head', 'neck', 1.0],
  ['neck', 'hip', 1.0],
  // Shoulders
  ['neck', 'shoulderL', 1.0],
  ['neck', 'shoulderR', 1.0],
  // Left arm
  ['shoulderL', 'elbowL', 1.0],
  ['elbowL', 'handL', 1.0],
  // Right arm
  ['shoulderR', 'elbowR', 1.0],
  ['elbowR', 'handR', 1.0],
  // Left leg
  ['hip', 'kneeL', 1.0],
  ['kneeL', 'footL', 1.0],
  // Right leg
  ['hip', 'kneeR', 1.0],
  ['kneeR', 'footR', 1.0],
  // Cross-braces for structural stability
  ['shoulderL', 'shoulderR', 0.6],
  ['head', 'hip', 0.6],
  ['shoulderL', 'hip', 0.6],
  ['shoulderR', 'hip', 0.6],
];

function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

export class RagdollPhysics {
  constructor(worldPose, knockbackVelX, knockbackVelY, visual, groundY) {
    this.elapsed = 0;
    this.groundY = groundY !== undefined ? groundY : DEFAULT_GROUND_Y;

    // Heavier visual fighters (thicker lines) have more mass and less bounce
    const lineWidth = (visual && visual.lineWidth) || 1.0;
    const massScale = 0.8 + lineWidth * 0.2; // 1.0 at lineWidth=1, higher for thicker
    this.bounceScale = Math.max(0.1, 1.2 - lineWidth * 0.2); // less bounce for heavier

    // Create particles from world-space joint positions
    this.particles = {};
    for (const name of JOINT_NAMES) {
      const pos = worldPose[name];
      const mass = (MASS[name] || 1.0) * massScale;
      const frac = KNOCKBACK_FRAC[name] || 0.5;
      // prevX/prevY encode initial velocity via Verlet:
      // velocity = pos - prev, so prev = pos - velocity * dt
      // We use a nominal dt of 1/60 to seed the velocity
      const dt = 1 / 60;
      this.particles[name] = {
        x: pos.x,
        y: pos.y,
        prevX: pos.x - knockbackVelX * frac * dt,
        prevY: pos.y - knockbackVelY * frac * dt,
        mass,
      };
    }

    // Build constraints with rest lengths from initial positions
    this.constraints = BONES.map(([a, b, stiffness]) => {
      const pa = this.particles[a];
      const pb = this.particles[b];
      return {
        a,
        b,
        restLength: dist(pa.x, pa.y, pb.x, pb.y),
        stiffness,
      };
    });
  }

  update(deltaSec) {
    // Clamp dt to prevent physics explosion on lag spikes
    const dt = Math.min(deltaSec, 0.033);
    this.elapsed += dt * 1000;

    const settling = this.elapsed > SETTLE_TIME;
    const damp = settling ? SETTLE_DAMPING : DAMPING;
    const bounce = BOUNCE * this.bounceScale;

    // Verlet integration
    for (const name of JOINT_NAMES) {
      const p = this.particles[name];
      const vx = (p.x - p.prevX) * damp;
      const vy = (p.y - p.prevY) * damp;
      p.prevX = p.x;
      p.prevY = p.y;
      p.x += vx + 0 * dt * dt; // no horizontal gravity
      p.y += vy + GRAVITY * dt * dt;
    }

    // Constraint solving + collision (interleaved for stability)
    for (let iter = 0; iter < CONSTRAINT_ITERATIONS; iter++) {
      // Enforce distance constraints
      for (const c of this.constraints) {
        const pa = this.particles[c.a];
        const pb = this.particles[c.b];
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 0.001) continue;

        const diff = (d - c.restLength) / d;
        const totalMass = pa.mass + pb.mass;
        const ratioA = (pb.mass / totalMass) * c.stiffness;
        const ratioB = (pa.mass / totalMass) * c.stiffness;

        pa.x += dx * diff * ratioA;
        pa.y += dy * diff * ratioA;
        pb.x -= dx * diff * ratioB;
        pb.y -= dy * diff * ratioB;
      }

      // Ground collision after each iteration
      for (const name of JOINT_NAMES) {
        const p = this.particles[name];
        if (p.y > this.groundY) {
          p.y = this.groundY;
          // Bounce: reflect vertical velocity
          const vy = p.y - p.prevY;
          if (vy > 0) {
            p.prevY = p.y + vy * bounce;
          }
          // Friction: reduce horizontal velocity
          const vx = p.x - p.prevX;
          p.prevX = p.x - vx * GROUND_FRICTION;
        }

        // Stage boundary clamping (skip for bottomless maps where ragdoll falls off)
        if (this.groundY <= DEFAULT_GROUND_Y + 100) {
          if (p.x < STAGE_LEFT) {
            p.x = STAGE_LEFT;
            p.prevX = Math.max(p.prevX, STAGE_LEFT);
          }
          if (p.x > STAGE_RIGHT) {
            p.x = STAGE_RIGHT;
            p.prevX = Math.min(p.prevX, STAGE_RIGHT);
          }
        }
      }
    }
  }

  getWorldPositions() {
    const result = {};
    for (const name of JOINT_NAMES) {
      const p = this.particles[name];
      result[name] = { x: p.x, y: p.y };
    }
    return result;
  }
}
