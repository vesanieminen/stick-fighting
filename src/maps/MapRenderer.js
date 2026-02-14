import Phaser from 'phaser';

export class MapRenderer {
  constructor(scene, mapData) {
    this.scene = scene;
    this.map = mapData;

    // Persistent graphics layers
    this.bgGraphics = null;
    this.decoGraphics = null;
    this.platformGraphics = null;
    this.lavaGraphics = null;
    this.movingPlatGraphics = null;
    this.spikeGraphics = null;

    // Moving platform current positions (updated from FightScene)
    this.movingPlatformPositions = [];
  }

  /** Draw the full map (background, ground, decorations, platforms). Called once in create(). */
  draw() {
    const { scene, map } = this;

    // Background
    this.bgGraphics = scene.add.graphics().setDepth(0);
    this.bgGraphics.fillStyle(map.bgColor, 1);
    this.bgGraphics.fillRect(0, 0, 1280, 720);

    if (!map.noGround) {
      // Ground
      this.bgGraphics.fillStyle(map.groundColor, 1);
      this.bgGraphics.fillRect(0, map.groundY, 1280, 100);

      // Ground line
      this.bgGraphics.lineStyle(3, map.groundLineColor, 1);
      this.bgGraphics.lineBetween(0, map.groundY, 1280, map.groundY);

      // Stage boundaries
      this.bgGraphics.lineStyle(1, map.groundLineColor, 0.3);
      this.bgGraphics.lineBetween(map.stageLeft, 0, map.stageLeft, map.groundY);
      this.bgGraphics.lineBetween(map.stageRight, 0, map.stageRight, map.groundY);
    }

    // Decorations (depth 1 — behind platforms)
    this.decoGraphics = scene.add.graphics().setDepth(1);
    this.drawDecorations(this.decoGraphics, 0);

    // Platforms (depth 2)
    this.platformGraphics = scene.add.graphics().setDepth(2);
    this.drawPlatforms(this.platformGraphics);

    // Spikes layer (depth 1, static)
    const hasSpikes = map.hazards.some(h => h.type === 'spikes');
    if (hasSpikes) {
      this.spikeGraphics = scene.add.graphics().setDepth(1);
      this.drawSpikes(this.spikeGraphics);
    }

    // Lava layer (depth 1, animated — redrawn each frame)
    if (map.hazards.some(h => h.type === 'lava')) {
      this.lavaGraphics = scene.add.graphics().setDepth(1);
    }

    // Moving platforms layer (depth 2, redrawn each frame)
    if (map.movingPlatforms && map.movingPlatforms.length > 0) {
      this.movingPlatGraphics = scene.add.graphics().setDepth(2);
    }
  }

  drawPlatforms(g) {
    for (const p of this.map.platforms) {
      // Platform body
      g.fillStyle(p.color, 1);
      g.fillRect(p.x, p.y, p.width, p.height);
      // Top edge line
      g.lineStyle(2, p.lineColor, 1);
      g.lineBetween(p.x, p.y, p.x + p.width, p.y);
    }
  }

  drawDecorations(g, time) {
    for (const d of this.map.decorations) {
      switch (d.type) {
        case 'rect':
          g.fillStyle(d.color, d.alpha || 0.5);
          g.fillRect(d.x, d.y, d.w, d.h);
          break;

        case 'chain':
          this.drawChain(g, d.x, d.y, d.length);
          break;

        case 'stars':
          this.drawStars(g, d.count);
          break;

        case 'cloud':
          this.drawCloud(g, d.x, d.y, d.w, d.alpha);
          break;

        case 'stalactite':
          this.drawStalactite(g, d.x, d.y, d.h);
          break;

        case 'stalagmite':
          this.drawStalagmite(g, d.x, d.groundY, d.h);
          break;

        case 'crystal':
          this.drawCrystal(g, d.x, d.y, d.color);
          break;

        case 'building':
          this.drawBuilding(g, d);
          break;

        case 'gear':
          this.drawGear(g, d.x, d.y, d.radius || 25);
          break;

        case 'abyssFog':
          this.drawAbyssFog(g, d.y, d.count || 6, time || 0);
          break;
      }
    }
  }

  drawChain(g, x, startY, length) {
    const linkSize = 8;
    const links = Math.floor(length / linkSize);
    g.lineStyle(2, 0x666666, 0.5);
    for (let i = 0; i < links; i++) {
      const ly = startY + i * linkSize;
      g.strokeRect(x - 3, ly, 6, linkSize);
    }
  }

  drawStars(g, count) {
    // Use deterministic positions based on count so they don't shift
    const seed = count * 7;
    for (let i = 0; i < count; i++) {
      const px = ((seed + i * 137) % 1280);
      const py = ((seed + i * 89) % 400);
      const brightness = 0.3 + ((i * 31) % 7) / 10;
      const size = 1 + ((i * 17) % 3) * 0.5;
      g.fillStyle(0xffffff, brightness);
      g.fillCircle(px, py, size);
    }
  }

  drawCloud(g, x, y, w, alpha) {
    g.fillStyle(0xffffff, alpha);
    const h = w * 0.3;
    g.fillEllipse(x + w / 2, y, w, h);
    g.fillEllipse(x + w * 0.3, y - h * 0.3, w * 0.6, h * 0.8);
    g.fillEllipse(x + w * 0.7, y - h * 0.2, w * 0.5, h * 0.7);
  }

  drawStalactite(g, x, y, h) {
    g.fillStyle(0x3a3a2a, 0.7);
    g.fillTriangle(x - 12, y, x + 12, y, x, y + h);
    g.lineStyle(1, 0x555540, 0.4);
    g.lineBetween(x, y, x, y + h);
  }

  drawStalagmite(g, x, groundY, h) {
    g.fillStyle(0x3a3a2a, 0.7);
    g.fillTriangle(x - 10, groundY, x + 10, groundY, x, groundY - h);
    g.lineStyle(1, 0x555540, 0.4);
    g.lineBetween(x, groundY, x, groundY - h);
  }

  drawCrystal(g, x, y, color) {
    // Small glowing crystal sitting on a platform
    g.fillStyle(color, 0.6);
    g.fillTriangle(x - 5, y, x + 5, y, x, y - 18);
    g.fillTriangle(x - 8, y, x, y, x - 4, y - 12);
    // Glow
    g.fillStyle(color, 0.15);
    g.fillCircle(x, y - 8, 14);
  }

  drawBuilding(g, d) {
    const { x, w, h, groundY, windowColor, distant } = d;
    const bY = groundY - h;
    const alpha = distant ? 0.2 : 0.4;

    g.fillStyle(0x111122, alpha);
    g.fillRect(x, bY, w, h);

    // Windows
    const winW = 4;
    const winH = 5;
    const cols = Math.floor((w - 6) / 10);
    const rows = Math.floor((h - 10) / 14);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Some windows are dark
        const lit = ((r * 7 + c * 13) % 5) !== 0;
        if (lit) {
          g.fillStyle(windowColor, distant ? 0.15 : 0.3);
          g.fillRect(x + 4 + c * 10, bY + 6 + r * 14, winW, winH);
        }
      }
    }
  }

  drawSpikes(g) {
    for (const hazard of this.map.hazards) {
      if (hazard.type !== 'spikes') continue;
      const y = hazard.y;
      const color = hazard.color || 0xcc3333;
      const spikeW = 20;
      const spikeH = 16;

      // Row of triangles across the stage
      for (let x = 0; x < 1280; x += spikeW) {
        g.fillStyle(color, 0.9);
        g.fillTriangle(x, y + spikeH, x + spikeW, y + spikeH, x + spikeW / 2, y);
        // Highlight edge
        g.lineStyle(1, 0xff6666, 0.5);
        g.lineBetween(x + spikeW / 2, y, x + spikeW, y + spikeH);
      }
    }
  }

  drawGear(g, x, y, radius) {
    const teeth = 8;
    const innerR = radius * 0.7;
    g.lineStyle(2, 0x556688, 0.4);

    // Cog outline
    for (let i = 0; i < teeth; i++) {
      const angle = (Math.PI * 2 * i) / teeth;
      const nextAngle = (Math.PI * 2 * (i + 0.5)) / teeth;
      const ox = x + Math.cos(angle) * radius;
      const oy = y + Math.sin(angle) * radius;
      const ix = x + Math.cos(nextAngle) * innerR;
      const iy = y + Math.sin(nextAngle) * innerR;
      g.lineBetween(ox, oy, ix, iy);

      const nextOuter = (Math.PI * 2 * (i + 1)) / teeth;
      const ox2 = x + Math.cos(nextOuter) * radius;
      const oy2 = y + Math.sin(nextOuter) * radius;
      g.lineBetween(ix, iy, ox2, oy2);
    }

    // Center circle
    g.strokeCircle(x, y, radius * 0.25);
  }

  drawAbyssFog(g, y, count, time) {
    const t = time * 0.001;
    for (let i = 0; i < count; i++) {
      const baseX = (i / count) * 1280;
      const waveX = baseX + Math.sin(t * 0.5 + i * 1.3) * 40;
      const waveY = y + Math.sin(t * 0.7 + i * 0.9) * 10;
      const alpha = 0.06 + Math.sin(t * 0.3 + i * 2.1) * 0.03;
      const w = 120 + Math.sin(t * 0.4 + i) * 30;

      g.fillStyle(0x6666aa, alpha);
      g.fillEllipse(waveX, waveY, w, 12);
    }
  }

  /** Update animated elements. Called each frame from FightScene.update(). */
  update(time) {
    if (!this.map.animated) return;

    if (this.lavaGraphics) {
      for (const hazard of this.map.hazards) {
        if (hazard.type === 'lava') {
          this.drawLava(this.lavaGraphics, hazard, time);
        }
      }
    }

    // Redraw moving platforms at current positions
    if (this.movingPlatGraphics && this.movingPlatformPositions.length > 0) {
      this.movingPlatGraphics.clear();
      for (const mp of this.movingPlatformPositions) {
        this.movingPlatGraphics.fillStyle(mp.color, 1);
        this.movingPlatGraphics.fillRect(mp.x, mp.y, mp.width, mp.height);
        this.movingPlatGraphics.lineStyle(2, mp.lineColor, 1);
        this.movingPlatGraphics.lineBetween(mp.x, mp.y, mp.x + mp.width, mp.y);
      }
    }

    // Animated decorations (abyss fog)
    if (this.decoGraphics) {
      for (const d of this.map.decorations) {
        if (d.type === 'abyssFog') {
          // Need to redraw the deco layer for animated fog
          this.decoGraphics.clear();
          this.drawDecorations(this.decoGraphics, time);
          break;
        }
      }
    }
  }

  drawLava(g, hazard, time) {
    g.clear();

    const y = hazard.y;
    const t = time * 0.001; // seconds

    // Color cycling between red/orange/yellow
    const colorPhase = (Math.sin(t * 1.5) + 1) / 2; // 0–1
    const r = 255;
    const green = Math.floor(40 + colorPhase * 160); // 40–200
    const b = Math.floor(colorPhase * 40); // 0–40
    const lavaColor = (r << 16) | (green << 8) | b;

    // Fill lava body
    g.fillStyle(lavaColor, 0.85);
    g.fillRect(0, y + 8, 1280, 100);

    // Darker underlayer
    g.fillStyle(hazard.color1, 0.4);
    g.fillRect(0, y + 30, 1280, 70);

    // Surface waves — two overlapping sine waves
    g.beginPath();
    g.moveTo(0, y + 10);

    for (let x = 0; x <= 1280; x += 4) {
      const wave1 = Math.sin(x * 0.008 + t * 2.0) * 6;
      const wave2 = Math.sin(x * 0.015 + t * 3.2) * 4;
      const wy = y + wave1 + wave2;
      g.lineTo(x, wy);
    }
    g.lineTo(1280, y + 20);
    g.lineTo(0, y + 20);
    g.closePath();

    g.fillStyle(lavaColor, 1);
    g.fillPath();

    // Glow line at surface with pulsing opacity
    const glowAlpha = 0.4 + Math.sin(t * 4) * 0.3;
    g.lineStyle(3, hazard.color3, glowAlpha);
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 1280; x += 4) {
      const wave1 = Math.sin(x * 0.008 + t * 2.0) * 6;
      const wave2 = Math.sin(x * 0.015 + t * 3.2) * 4;
      g.lineTo(x, y + wave1 + wave2);
    }
    g.strokePath();
  }

  /**
   * Draw a small preview thumbnail of this map into a graphics object.
   * Used by MapSelectScene.
   */
  drawPreview(g, cx, cy, w, h) {
    const map = this.map;
    const scaleX = w / 1280;
    const scaleY = h / 720;

    // Background
    g.fillStyle(map.bgColor, 1);
    g.fillRect(cx - w / 2, cy - h / 2, w, h);

    const groundLocalY = map.groundY * scaleY;

    if (!map.noGround) {
      // Ground
      g.fillStyle(map.groundColor, 1);
      g.fillRect(cx - w / 2, cy - h / 2 + groundLocalY, w, h - groundLocalY);

      // Ground line
      g.lineStyle(1, map.groundLineColor, 1);
      g.lineBetween(cx - w / 2, cy - h / 2 + groundLocalY, cx + w / 2, cy - h / 2 + groundLocalY);
    }

    // Platforms
    for (const p of map.platforms) {
      const px = cx - w / 2 + p.x * scaleX;
      const py = cy - h / 2 + p.y * scaleY;
      const pw = p.width * scaleX;
      const ph = Math.max(p.height * scaleY, 2);
      g.fillStyle(p.color, 1);
      g.fillRect(px, py, pw, ph);
      g.lineStyle(1, p.lineColor, 1);
      g.lineBetween(px, py, px + pw, py);
    }

    // Moving platforms (static preview at base position)
    if (map.movingPlatforms) {
      for (const mp of map.movingPlatforms) {
        const px = cx - w / 2 + mp.x * scaleX;
        const py = cy - h / 2 + mp.y * scaleY;
        const pw = mp.width * scaleX;
        const ph = Math.max(mp.height * scaleY, 2);
        g.fillStyle(mp.color, 1);
        g.fillRect(px, py, pw, ph);
        g.lineStyle(1, mp.lineColor, 1);
        g.lineBetween(px, py, px + pw, py);
      }
    }

    // Hazard hints (static for preview)
    for (const hazard of map.hazards) {
      if (hazard.type === 'lava') {
        const lavaY = cy - h / 2 + hazard.y * scaleY;
        g.fillStyle(hazard.color2, 0.7);
        g.fillRect(cx - w / 2, lavaY + 2, w, h - (hazard.y * scaleY) - 2);
        g.lineStyle(1, hazard.color3, 0.8);
        g.lineBetween(cx - w / 2, lavaY, cx + w / 2, lavaY);
      } else if (hazard.type === 'spikes') {
        const spikeY = cy - h / 2 + hazard.y * scaleY;
        const spikeColor = hazard.color || 0xcc3333;
        // Simplified spikes: a colored strip
        g.fillStyle(spikeColor, 0.7);
        g.fillRect(cx - w / 2, spikeY, w, h - (hazard.y * scaleY));
        // Small triangles hint
        const spikeW = 6;
        for (let sx = cx - w / 2; sx < cx + w / 2; sx += spikeW) {
          g.fillStyle(spikeColor, 0.9);
          g.fillTriangle(sx, spikeY + 4, sx + spikeW, spikeY + 4, sx + spikeW / 2, spikeY);
        }
      }
    }

    // Simplified decorations for preview
    for (const d of map.decorations) {
      if (d.type === 'stars') {
        for (let i = 0; i < Math.min(d.count, 15); i++) {
          const sx = cx - w / 2 + ((i * 137) % w);
          const sy = cy - h / 2 + ((i * 89) % (groundLocalY * 0.7));
          g.fillStyle(0xffffff, 0.4);
          g.fillCircle(sx, sy, 0.8);
        }
      } else if (d.type === 'building') {
        const bx = cx - w / 2 + d.x * scaleX;
        const bw = d.w * scaleX;
        const bh = d.h * scaleY;
        const bY = cy - h / 2 + d.groundY * scaleY - bh;
        g.fillStyle(0x111122, d.distant ? 0.2 : 0.4);
        g.fillRect(bx, bY, bw, bh);
      } else if (d.type === 'crystal') {
        const dx = cx - w / 2 + d.x * scaleX;
        const dy = cy - h / 2 + d.y * scaleY;
        g.fillStyle(d.color, 0.5);
        g.fillCircle(dx, dy - 3, 2);
      }
    }
  }

  /** Clean up all graphics objects */
  destroy() {
    if (this.bgGraphics) this.bgGraphics.destroy();
    if (this.decoGraphics) this.decoGraphics.destroy();
    if (this.platformGraphics) this.platformGraphics.destroy();
    if (this.lavaGraphics) this.lavaGraphics.destroy();
    if (this.movingPlatGraphics) this.movingPlatGraphics.destroy();
    if (this.spikeGraphics) this.spikeGraphics.destroy();
  }
}
