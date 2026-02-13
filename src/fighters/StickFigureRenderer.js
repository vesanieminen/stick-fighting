import { GAME_CONFIG } from '../config.js';

export class StickFigureRenderer {
  constructor(graphics) {
    this.graphics = graphics;
  }

  draw(x, y, pose, facingRight, color = 0xffffff, showGhost = false) {
    const g = this.graphics;
    const dir = facingRight ? 1 : -1;

    g.clear();

    // Motion ghost (offset backward for speed blur during attacks)
    if (showGhost) {
      const gp = this.transformPose(x - dir * 10, y, pose, dir);
      this.drawFigure(g, gp, color, 0.12);
    }

    // Main figure
    const p = this.transformPose(x, y, pose, dir);
    this.drawFigure(g, p, color, 1.0);
  }

  transformPose(x, y, pose, dir) {
    const p = {};
    for (const joint in pose) {
      p[joint] = {
        x: x + pose[joint].x * dir,
        y: y + pose[joint].y,
      };
    }
    return p;
  }

  drawFigure(g, p, color, alpha) {
    const lw = GAME_CONFIG.LINE_WIDTH;
    const hr = GAME_CONFIG.HEAD_RADIUS;

    // Head
    g.fillStyle(color, 0.25 * alpha);
    g.fillCircle(p.head.x, p.head.y, hr);
    g.lineStyle(lw, color, alpha);
    g.strokeCircle(p.head.x, p.head.y, hr);

    // Torso (neck to hip) — thicker for visual weight
    g.lineStyle(lw + 1, color, alpha);
    g.lineBetween(p.neck.x, p.neck.y, p.hip.x, p.hip.y);

    // Shoulders line
    g.lineStyle(lw, color, alpha);
    g.lineBetween(p.shoulderL.x, p.shoulderL.y, p.shoulderR.x, p.shoulderR.y);

    // Left arm
    this.drawLimb(g, p.shoulderL, p.elbowL, color, lw, alpha);
    this.drawLimb(g, p.elbowL, p.handL, color, lw, alpha);

    // Right arm
    this.drawLimb(g, p.shoulderR, p.elbowR, color, lw, alpha);
    this.drawLimb(g, p.elbowR, p.handR, color, lw, alpha);

    // Left leg
    this.drawLimb(g, p.hip, p.kneeL, color, lw, alpha);
    this.drawLimb(g, p.kneeL, p.footL, color, lw, alpha);

    // Right leg
    this.drawLimb(g, p.hip, p.kneeR, color, lw, alpha);
    this.drawLimb(g, p.kneeR, p.footR, color, lw, alpha);

    // Joint dots — gives the figure visual weight and definition
    g.fillStyle(color, 0.7 * alpha);
    const jr = 2.5;
    g.fillCircle(p.elbowL.x, p.elbowL.y, jr);
    g.fillCircle(p.elbowR.x, p.elbowR.y, jr);
    g.fillCircle(p.kneeL.x, p.kneeL.y, jr);
    g.fillCircle(p.kneeR.x, p.kneeR.y, jr);

    // Hands and feet — slightly larger
    const er = 3;
    g.fillCircle(p.handL.x, p.handL.y, er);
    g.fillCircle(p.handR.x, p.handR.y, er);
    g.fillCircle(p.footL.x, p.footL.y, er);
    g.fillCircle(p.footR.x, p.footR.y, er);
  }

  drawLimb(g, from, to, color, lineWidth, alpha) {
    g.lineStyle(lineWidth, color, alpha);
    g.lineBetween(from.x, from.y, to.x, to.y);
  }
}
