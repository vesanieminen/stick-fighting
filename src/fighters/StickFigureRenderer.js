import { GAME_CONFIG } from '../config.js';

export class StickFigureRenderer {
  constructor(graphics) {
    this.graphics = graphics;
  }

  draw(x, y, pose, facingRight, color = 0xffffff) {
    const g = this.graphics;
    const dir = facingRight ? 1 : -1;

    g.clear();

    // Transform joint positions to world coordinates
    const p = {};
    for (const joint in pose) {
      p[joint] = {
        x: x + pose[joint].x * dir,
        y: y + pose[joint].y
      };
    }

    const lw = GAME_CONFIG.LINE_WIDTH;
    const hr = GAME_CONFIG.HEAD_RADIUS;

    // Head
    g.fillStyle(color, 0.3);
    g.fillCircle(p.head.x, p.head.y, hr);
    g.lineStyle(lw, color, 1);
    g.strokeCircle(p.head.x, p.head.y, hr);

    // Torso (neck to hip)
    this.drawLine(p.neck, p.hip, color);

    // Shoulders line
    this.drawLine(p.shoulderL, p.shoulderR, color);

    // Left arm
    this.drawLine(p.shoulderL, p.elbowL, color);
    this.drawLine(p.elbowL, p.handL, color);

    // Right arm
    this.drawLine(p.shoulderR, p.elbowR, color);
    this.drawLine(p.elbowR, p.handR, color);

    // Left leg
    this.drawLine(p.hip, p.kneeL, color);
    this.drawLine(p.kneeL, p.footL, color);

    // Right leg
    this.drawLine(p.hip, p.kneeR, color);
    this.drawLine(p.kneeR, p.footR, color);
  }

  drawLine(from, to, color) {
    this.graphics.lineStyle(GAME_CONFIG.LINE_WIDTH, color, 1);
    this.graphics.lineBetween(from.x, from.y, to.x, to.y);
  }
}
