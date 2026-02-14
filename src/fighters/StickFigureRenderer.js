import { GAME_CONFIG } from '../config.js';

const DEFAULT_VISUAL = {
  headRadius: 1.0,
  lineWidth: 1.0,
  limbScale: 1.0,
  shoulderWidth: 1.0,
  headShape: 'circle',
  accessories: [],
};

export class StickFigureRenderer {
  constructor(graphics) {
    this.graphics = graphics;
  }

  draw(x, y, pose, facingRight, color = 0xffffff, showGhost = false, visual = null) {
    const g = this.graphics;
    const dir = facingRight ? 1 : -1;
    const v = visual || DEFAULT_VISUAL;

    g.clear();

    // Motion ghost (offset backward for speed blur during attacks)
    if (showGhost) {
      const gp = this.transformPose(x - dir * 10, y, pose, dir, v);
      this.drawFigure(g, gp, color, 0.12, v);
    }

    // Main figure
    const p = this.transformPose(x, y, pose, dir, v);
    this.drawFigure(g, p, color, 1.0, v);
    this.drawAccessories(g, p, color, 1.0, v, dir);
  }

  transformPose(x, y, pose, dir, visual) {
    const v = visual || DEFAULT_VISUAL;
    const limbScale = v.limbScale || 1.0;
    const shoulderWidth = v.shoulderWidth || 1.0;
    const p = {};

    for (const joint in pose) {
      let sx = pose[joint].x * limbScale;
      let sy = pose[joint].y * limbScale;

      // Apply extra shoulder width scaling to shoulder joints
      if (joint === 'shoulderL' || joint === 'shoulderR') {
        sx = pose[joint].x * shoulderWidth * limbScale;
      }

      p[joint] = {
        x: x + sx * dir,
        y: y + sy,
      };
    }
    return p;
  }

  drawFigure(g, p, color, alpha, visual) {
    const v = visual || DEFAULT_VISUAL;
    const lw = GAME_CONFIG.LINE_WIDTH * (v.lineWidth || 1.0);
    const hr = GAME_CONFIG.HEAD_RADIUS * (v.headRadius || 1.0);

    // Head
    this.drawHead(g, p.head.x, p.head.y, hr, color, alpha, lw, v.headShape || 'circle');

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

  drawHead(g, x, y, radius, color, alpha, lineWidth, shape) {
    switch (shape) {
      case 'angular': {
        // Diamond shape
        g.fillStyle(color, 0.25 * alpha);
        g.beginPath();
        g.moveTo(x, y - radius);
        g.lineTo(x + radius, y);
        g.lineTo(x, y + radius);
        g.lineTo(x - radius, y);
        g.closePath();
        g.fillPath();
        g.lineStyle(lineWidth, color, alpha);
        g.beginPath();
        g.moveTo(x, y - radius);
        g.lineTo(x + radius, y);
        g.lineTo(x, y + radius);
        g.lineTo(x - radius, y);
        g.closePath();
        g.strokePath();
        break;
      }
      case 'flat': {
        // Rectangle head
        const w = radius * 1.4;
        const h = radius * 1.1;
        g.fillStyle(color, 0.25 * alpha);
        g.fillRect(x - w, y - h, w * 2, h * 2);
        g.lineStyle(lineWidth, color, alpha);
        g.strokeRect(x - w, y - h, w * 2, h * 2);
        break;
      }
      default: {
        // Circle (default)
        g.fillStyle(color, 0.25 * alpha);
        g.fillCircle(x, y, radius);
        g.lineStyle(lineWidth, color, alpha);
        g.strokeCircle(x, y, radius);
        break;
      }
    }
  }

  drawAccessories(g, p, color, alpha, visual, dir) {
    const v = visual || DEFAULT_VISUAL;
    if (!v.accessories || v.accessories.length === 0) return;

    for (const acc of v.accessories) {
      switch (acc.type) {
        case 'headband': {
          // Trailing lines from back of head
          const hx = p.head.x;
          const hy = p.head.y;
          const hr = GAME_CONFIG.HEAD_RADIUS * (v.headRadius || 1.0);
          g.lineStyle(2, color, 0.7 * alpha);
          g.lineBetween(hx - dir * hr, hy - 2, hx - dir * (hr + 14), hy - 6);
          g.lineBetween(hx - dir * hr, hy, hx - dir * (hr + 18), hy - 2);
          break;
        }
        case 'shoulderPads': {
          // Small triangles on each shoulder
          const sz = 8;
          for (const sh of [p.shoulderL, p.shoulderR]) {
            g.fillStyle(color, 0.5 * alpha);
            g.fillTriangle(
              sh.x - sz, sh.y,
              sh.x + sz, sh.y,
              sh.x, sh.y - sz
            );
          }
          break;
        }
        case 'scarf': {
          // Wavy trailing lines from neck
          const nx = p.neck.x;
          const ny = p.neck.y;
          g.lineStyle(2, color, 0.5 * alpha);
          g.beginPath();
          g.moveTo(nx, ny);
          g.lineTo(nx - dir * 10, ny + 8);
          g.lineTo(nx - dir * 5, ny + 16);
          g.lineTo(nx - dir * 14, ny + 24);
          g.strokePath();
          g.lineStyle(1.5, color, 0.3 * alpha);
          g.beginPath();
          g.moveTo(nx, ny + 2);
          g.lineTo(nx - dir * 12, ny + 12);
          g.lineTo(nx - dir * 7, ny + 20);
          g.lineTo(nx - dir * 16, ny + 28);
          g.strokePath();
          break;
        }
        case 'flameHair': {
          // 3 spike triangles above head
          const hx = p.head.x;
          const hy = p.head.y;
          const hr = GAME_CONFIG.HEAD_RADIUS * (v.headRadius || 1.0);
          g.fillStyle(color, 0.6 * alpha);
          // Center spike
          g.fillTriangle(hx - 4, hy - hr, hx + 4, hy - hr, hx, hy - hr - 14);
          // Left spike
          g.fillTriangle(hx - 8, hy - hr + 2, hx - 2, hy - hr, hx - 6, hy - hr - 10);
          // Right spike
          g.fillTriangle(hx + 2, hy - hr, hx + 8, hy - hr + 2, hx + 6, hy - hr - 10);
          break;
        }
        case 'iceShard': {
          // Diamond shape on back shoulder
          const sh = dir > 0 ? p.shoulderL : p.shoulderR;
          const sz = 6;
          g.fillStyle(color, 0.5 * alpha);
          g.fillTriangle(
            sh.x - dir * 4, sh.y - sz * 1.5,
            sh.x - dir * 4 - sz, sh.y,
            sh.x - dir * 4 + sz, sh.y
          );
          g.fillTriangle(
            sh.x - dir * 4, sh.y + sz * 1.5,
            sh.x - dir * 4 - sz, sh.y,
            sh.x - dir * 4 + sz, sh.y
          );
          break;
        }
        case 'boltMark': {
          // Zigzag on torso
          const nx = p.neck.x;
          const ny = p.neck.y;
          const hx = p.hip.x;
          const midX = (nx + hx) / 2;
          const midY = (ny + p.hip.y) / 2;
          g.lineStyle(2, color, 0.6 * alpha);
          g.beginPath();
          g.moveTo(midX - 4, midY - 10);
          g.lineTo(midX + 3, midY - 3);
          g.lineTo(midX - 3, midY + 3);
          g.lineTo(midX + 4, midY + 10);
          g.strokePath();
          break;
        }
        case 'tail': {
          // Curved line from hip backward
          const hx = p.hip.x;
          const hy = p.hip.y;
          g.lineStyle(2, color, 0.5 * alpha);
          g.beginPath();
          g.moveTo(hx, hy);
          g.lineTo(hx - dir * 12, hy + 5);
          g.lineTo(hx - dir * 20, hy + 2);
          g.lineTo(hx - dir * 26, hy + 8);
          g.strokePath();
          break;
        }
        case 'armGuards': {
          // Circles around elbows
          const gr = 5;
          g.lineStyle(2, color, 0.5 * alpha);
          g.strokeCircle(p.elbowL.x, p.elbowL.y, gr);
          g.strokeCircle(p.elbowR.x, p.elbowR.y, gr);
          break;
        }
        case 'wisps': {
          // Small floating dots around body
          const cx = (p.neck.x + p.hip.x) / 2;
          const cy = (p.neck.y + p.hip.y) / 2;
          g.fillStyle(color, 0.35 * alpha);
          g.fillCircle(cx + dir * 22, cy - 15, 2);
          g.fillCircle(cx - dir * 18, cy + 5, 1.5);
          g.fillCircle(cx + dir * 15, cy + 18, 2);
          g.fillCircle(cx - dir * 25, cy - 8, 1.5);
          g.fillCircle(cx + dir * 8, cy - 25, 1.5);
          break;
        }
        case 'halo': {
          // Ellipse ring above head
          const hx = p.head.x;
          const hy = p.head.y;
          const hr = GAME_CONFIG.HEAD_RADIUS * (v.headRadius || 1.0);
          g.lineStyle(1.5, color, 0.5 * alpha);
          // Draw an ellipse above head
          const ew = hr * 1.1;
          const eh = hr * 0.35;
          const ey = hy - hr - 6;
          g.beginPath();
          for (let i = 0; i <= 20; i++) {
            const angle = (Math.PI * 2 * i) / 20;
            const px = hx + Math.cos(angle) * ew;
            const py = ey + Math.sin(angle) * eh;
            if (i === 0) g.moveTo(px, py);
            else g.lineTo(px, py);
          }
          g.closePath();
          g.strokePath();
          break;
        }
      }
    }
  }

  drawLimb(g, from, to, color, lineWidth, alpha) {
    g.lineStyle(lineWidth, color, alpha);
    g.lineBetween(from.x, from.y, to.x, to.y);
  }
}
