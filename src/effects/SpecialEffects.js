/**
 * Visual effects for special moves.
 * Each function creates self-cleaning graphics that auto-destroy via tweens.
 */

export function spawnSpeedLines(scene, x, y, dirX, color, count = 5) {
  const g = scene.add.graphics().setDepth(8);
  for (let i = 0; i < count; i++) {
    const ly = y - 30 + Math.random() * 60;
    const lx = x - dirX * (10 + i * 12);
    const len = 20 + Math.random() * 25;
    g.lineStyle(2, color, 0.6 - i * 0.08);
    g.lineBetween(lx, ly, lx - dirX * len, ly);
  }
  scene.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
}

export function spawnDustPuff(scene, x, y, color = 0xaaaaaa) {
  const g = scene.add.graphics().setDepth(8);
  for (let i = 0; i < 6; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 5 + Math.random() * 15;
    const size = 3 + Math.random() * 4;
    g.fillStyle(color, 0.4);
    g.fillCircle(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist, size);
  }
  scene.tweens.add({ targets: g, alpha: 0, duration: 400, onComplete: () => g.destroy() });
}

export function spawnShockwave(scene, x, y, color, maxRadius = 80) {
  const g = scene.add.graphics().setDepth(12);
  scene.tweens.addCounter({
    from: 10, to: maxRadius, duration: 400,
    onUpdate: (tween) => {
      g.clear();
      const r = tween.getValue();
      const t = (r - 10) / (maxRadius - 10);
      g.lineStyle(3, color, (1 - t) * 0.8);
      g.strokeCircle(x, y, r);
      g.lineStyle(2, 0xffffff, (1 - t) * 0.4);
      g.strokeCircle(x, y, r * 0.6);
    },
    onComplete: () => g.destroy()
  });
}

export function spawnFireParticles(scene, x, y, color = 0xff6600, count = 8) {
  const g = scene.add.graphics().setDepth(8);
  const particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 80,
      vy: -100 - Math.random() * 150,
      size: 2 + Math.random() * 4,
    });
  }
  scene.tweens.addCounter({
    from: 0, to: 1, duration: 500,
    onUpdate: (tween) => {
      g.clear();
      const t = tween.getValue();
      particles.forEach(p => {
        p.x += p.vx * 0.016;
        p.y += p.vy * 0.016;
        p.vy += 120 * 0.016;
        g.fillStyle(color, 1 - t);
        g.fillCircle(p.x, p.y, p.size * (1 - t * 0.5));
        g.fillStyle(0xffff00, (1 - t) * 0.5);
        g.fillCircle(p.x, p.y, p.size * 0.4);
      });
    },
    onComplete: () => g.destroy()
  });
}

export function spawnFireTrail(scene, x, y, dirX, color = 0xff6600) {
  const g = scene.add.graphics().setDepth(7);
  for (let i = 0; i < 4; i++) {
    const px = x - dirX * (i * 8) + (Math.random() - 0.5) * 10;
    const py = y + (Math.random() - 0.5) * 15;
    const size = 3 + Math.random() * 5;
    g.fillStyle(color, 0.6);
    g.fillCircle(px, py, size);
    g.fillStyle(0xffff44, 0.3);
    g.fillCircle(px, py, size * 0.5);
  }
  scene.tweens.add({ targets: g, alpha: 0, duration: 250, onComplete: () => g.destroy() });
}

export function spawnIceTrail(scene, x, y, dirX, color = 0x66ccff) {
  const g = scene.add.graphics().setDepth(5);
  for (let i = 0; i < 6; i++) {
    const cx = x - dirX * i * 18 + (Math.random() - 0.5) * 8;
    const cy = y + (Math.random() - 0.5) * 6;
    const size = 3 + Math.random() * 5;
    g.fillStyle(color, 0.6);
    // Diamond shape
    g.fillTriangle(cx, cy - size, cx - size * 0.6, cy, cx + size * 0.6, cy);
    g.fillTriangle(cx, cy + size, cx - size * 0.6, cy, cx + size * 0.6, cy);
    g.fillStyle(0xffffff, 0.3);
    g.fillCircle(cx, cy - size * 0.3, 1.5);
  }
  scene.tweens.add({ targets: g, alpha: 0, duration: 600, onComplete: () => g.destroy() });
}

export function spawnIceCrystals(scene, x, y, color = 0x66ccff) {
  const g = scene.add.graphics().setDepth(12);
  const crystals = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 100;
    crystals.push({
      x: x, y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      size: 2 + Math.random() * 3,
    });
  }
  scene.tweens.addCounter({
    from: 0, to: 1, duration: 400,
    onUpdate: (tween) => {
      g.clear();
      const t = tween.getValue();
      crystals.forEach(c => {
        c.x += c.vx * 0.016;
        c.y += c.vy * 0.016;
        g.fillStyle(color, 1 - t);
        g.fillCircle(c.x, c.y, c.size);
      });
    },
    onComplete: () => g.destroy()
  });
}

export function spawnLightningBolt(scene, x1, y1, x2, y2, color = 0xffff00) {
  const g = scene.add.graphics().setDepth(15);
  const segments = 8;
  const points = [{ x: x1, y: y1 }];
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    points.push({
      x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * 40,
      y: y1 + (y2 - y1) * t + (Math.random() - 0.5) * 10,
    });
  }
  points.push({ x: x2, y: y2 });

  // Glow
  g.lineStyle(8, color, 0.3);
  for (let i = 0; i < points.length - 1; i++) {
    g.lineBetween(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
  }
  // Main bolt
  g.lineStyle(3, color, 1);
  for (let i = 0; i < points.length - 1; i++) {
    g.lineBetween(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
  }
  // White core
  g.lineStyle(1, 0xffffff, 0.9);
  for (let i = 0; i < points.length - 1; i++) {
    g.lineBetween(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
  }

  scene.tweens.add({ targets: g, alpha: 0, duration: 150, onComplete: () => g.destroy() });
}

export function spawnElectricSparks(scene, x, y, color = 0xffff00, count = 10) {
  const g = scene.add.graphics().setDepth(12);
  const sparks = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 100 + Math.random() * 200;
    sparks.push({
      x: x, y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 50,
      len: 4 + Math.random() * 8,
    });
  }
  scene.tweens.addCounter({
    from: 0, to: 1, duration: 300,
    onUpdate: (tween) => {
      g.clear();
      const t = tween.getValue();
      sparks.forEach(s => {
        s.x += s.vx * 0.016;
        s.y += s.vy * 0.016;
        const angle = Math.atan2(s.vy, s.vx);
        g.lineStyle(2, color, 1 - t);
        g.lineBetween(s.x, s.y, s.x - Math.cos(angle) * s.len, s.y - Math.sin(angle) * s.len);
      });
    },
    onComplete: () => g.destroy()
  });
}

export function spawnSlashMark(scene, x, y, dirX, color = 0x44ff44) {
  const g = scene.add.graphics().setDepth(12);
  const sx = x + dirX * 35;
  const angle1 = Math.random() * 0.5 - 0.25;
  const len = 20 + Math.random() * 15;

  g.lineStyle(3, color, 0.9);
  g.lineBetween(
    sx - Math.cos(angle1) * len, y - Math.sin(angle1) * len,
    sx + Math.cos(angle1) * len, y + Math.sin(angle1) * len
  );
  g.lineStyle(1, 0xffffff, 0.6);
  g.lineBetween(
    sx - Math.cos(angle1) * len, y - Math.sin(angle1) * len,
    sx + Math.cos(angle1) * len, y + Math.sin(angle1) * len
  );

  scene.tweens.add({ targets: g, alpha: 0, duration: 120, onComplete: () => g.destroy() });
}

export function spawnArmorGlow(scene, x, y, color = 0xaa8855, radius = 40) {
  const g = scene.add.graphics().setDepth(7);
  g.fillStyle(color, 0.15);
  g.fillCircle(x, y, radius);
  g.lineStyle(3, color, 0.6);
  g.strokeCircle(x, y, radius);
  g.lineStyle(6, color, 0.2);
  g.strokeCircle(x, y, radius + 5);
  scene.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
}

export function spawnWhirlwindArcs(scene, x, y, rotation, color = 0xddddff) {
  const g = scene.add.graphics().setDepth(8);
  const radius = 40;
  for (let i = 0; i < 3; i++) {
    const angle = rotation + (i * Math.PI * 2 / 3);
    g.lineStyle(3, color, 0.7);
    g.beginPath();
    g.arc(x, y, radius + i * 6, angle, angle + Math.PI * 0.6);
    g.strokePath();
  }
  // Dust
  for (let i = 0; i < 4; i++) {
    const a = rotation * 0.5 + i * Math.PI / 2;
    const r = radius + 12 + Math.random() * 10;
    g.fillStyle(0xaaaaaa, 0.3);
    g.fillCircle(x + Math.cos(a) * r, y + Math.sin(a) * r, 2);
  }
  scene.tweens.add({ targets: g, alpha: 0, duration: 120, onComplete: () => g.destroy() });
}

export function spawnChargingAura(scene, x, y, color, radius) {
  const g = scene.add.graphics().setDepth(8);
  g.fillStyle(color, 0.15);
  g.fillCircle(x, y, radius);
  g.lineStyle(2, color, 0.5);
  g.strokeCircle(x, y, radius);
  g.fillStyle(0xffffff, 0.2);
  g.fillCircle(x, y, radius * 0.3);
  scene.tweens.add({ targets: g, alpha: 0, duration: 80, onComplete: () => g.destroy() });
}

export function spawnExplosionRing(scene, x, y, color, maxRadius = 120) {
  // Screen flash
  const flash = scene.add.graphics().setDepth(100);
  flash.fillStyle(color, 0.3);
  flash.fillRect(0, 0, 1280, 720);
  scene.tweens.add({ targets: flash, alpha: 0, duration: 200, onComplete: () => flash.destroy() });

  // Expanding ring
  const g = scene.add.graphics().setDepth(15);
  scene.tweens.addCounter({
    from: 5, to: maxRadius, duration: 400,
    onUpdate: (tween) => {
      g.clear();
      const r = tween.getValue();
      const t = (r - 5) / (maxRadius - 5);
      g.lineStyle(4, color, (1 - t) * 0.9);
      g.strokeCircle(x, y, r);
      g.lineStyle(2, 0xffffff, (1 - t) * 0.6);
      g.strokeCircle(x, y, r * 0.7);
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + t * 3;
        g.fillStyle(color, (1 - t) * 0.7);
        g.fillCircle(x + Math.cos(angle) * r, y + Math.sin(angle) * r, 3);
      }
    },
    onComplete: () => g.destroy()
  });
}

export function spawnSmokePuff(scene, x, y, color = 0xbb44ff) {
  const g = scene.add.graphics().setDepth(12);
  scene.tweens.addCounter({
    from: 0, to: 1, duration: 400,
    onUpdate: (tween) => {
      g.clear();
      const t = tween.getValue();
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const dist = t * 25;
        const size = 6 + t * 8;
        g.fillStyle(color, (1 - t) * 0.5);
        g.fillCircle(
          x + Math.cos(angle) * dist,
          y + Math.sin(angle) * dist,
          size * (1 - t * 0.3)
        );
      }
    },
    onComplete: () => g.destroy()
  });
}

export function spawnTeleportFlash(scene, x, y, color = 0xbb44ff) {
  const g = scene.add.graphics().setDepth(15);
  g.fillStyle(0xffffff, 0.8);
  g.fillCircle(x, y, 15);
  g.fillStyle(color, 0.5);
  g.fillCircle(x, y, 30);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    g.lineStyle(2, color, 0.7);
    g.lineBetween(x, y, x + Math.cos(angle) * 35, y + Math.sin(angle) * 35);
  }
  scene.tweens.add({ targets: g, alpha: 0, duration: 250, onComplete: () => g.destroy() });
}

export function spawnComboFinisher(scene, x, y, dir, color, animType) {
  // White screen flash overlay (fades in 100ms)
  const flash = scene.add.graphics().setDepth(100);
  flash.fillStyle(0xffffff, 0.4);
  flash.fillRect(0, 0, 1280, 720);
  scene.tweens.add({ targets: flash, alpha: 0, duration: 100, onComplete: () => flash.destroy() });

  // Shockwave ring (radius 90) in fighter's color
  const ring = scene.add.graphics().setDepth(15);
  scene.tweens.addCounter({
    from: 8, to: 90, duration: 350,
    onUpdate: (tween) => {
      ring.clear();
      const r = tween.getValue();
      const t = (r - 8) / (90 - 8);
      ring.lineStyle(4, color, (1 - t) * 0.9);
      ring.strokeCircle(x, y, r);
      ring.lineStyle(2, 0xffffff, (1 - t) * 0.5);
      ring.strokeCircle(x, y, r * 0.6);
    },
    onComplete: () => ring.destroy()
  });

  // 8 radial speed lines from impact point
  const lines = scene.add.graphics().setDepth(12);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const innerR = 15;
    const outerR = 40 + Math.random() * 20;
    lines.lineStyle(2, 0xffffff, 0.8);
    lines.lineBetween(
      x + Math.cos(angle) * innerR, y + Math.sin(angle) * innerR,
      x + Math.cos(angle) * outerR, y + Math.sin(angle) * outerR
    );
  }
  scene.tweens.add({ targets: lines, alpha: 0, duration: 250, onComplete: () => lines.destroy() });

  if (animType === 'launch') {
    // Upward particle spray
    const pg = scene.add.graphics().setDepth(12);
    const particles = [];
    for (let i = 0; i < 10; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y,
        vx: (Math.random() - 0.5) * 60,
        vy: -150 - Math.random() * 200,
        size: 2 + Math.random() * 3,
      });
    }
    scene.tweens.addCounter({
      from: 0, to: 1, duration: 450,
      onUpdate: (tween) => {
        pg.clear();
        const t = tween.getValue();
        particles.forEach(p => {
          p.x += p.vx * 0.016;
          p.y += p.vy * 0.016;
          p.vy += 180 * 0.016;
          pg.fillStyle(color, 1 - t);
          pg.fillCircle(p.x, p.y, p.size * (1 - t * 0.4));
          pg.fillStyle(0xffffff, (1 - t) * 0.4);
          pg.fillCircle(p.x, p.y, p.size * 0.3);
        });
      },
      onComplete: () => pg.destroy()
    });
  } else {
    // Horizontal speed lines + ground crack
    const hlines = scene.add.graphics().setDepth(12);
    for (let i = 0; i < 6; i++) {
      const ly = y - 25 + i * 10;
      const lx = x + dir * (10 + i * 8);
      const len = 25 + Math.random() * 30;
      hlines.lineStyle(2, color, 0.7 - i * 0.08);
      hlines.lineBetween(lx, ly, lx + dir * len, ly);
    }
    scene.tweens.add({ targets: hlines, alpha: 0, duration: 200, onComplete: () => hlines.destroy() });

    // Ground crack below impact
    spawnGroundCrack(scene, x, y + 50, color);
  }
}

export function spawnWallImpact(scene, wallX, impactY, color, wallSpecialType) {
  // Wall crack lines radiating from impact point
  const crack = scene.add.graphics().setDepth(3);
  for (let i = 0; i < 7; i++) {
    const angle = -Math.PI * 0.4 + (i / 6) * Math.PI * 0.8;
    const len = 20 + Math.random() * 40;
    const midX = wallX + Math.cos(angle) * len * 0.5 + (Math.random() - 0.5) * 6;
    const midY = impactY + Math.sin(angle) * len * 0.5;
    const endX = wallX + Math.cos(angle) * len;
    const endY = impactY + Math.sin(angle) * len * 0.4;
    crack.lineStyle(2, 0xcccccc, 0.8);
    crack.lineBetween(wallX, impactY, midX, midY);
    crack.lineBetween(midX, midY, endX, endY);
  }
  scene.tweens.add({ targets: crack, alpha: 0, duration: 1500, onComplete: () => crack.destroy() });

  // Directional particle burst away from wall
  const burstDir = wallX < 640 ? 1 : -1;
  const pg = scene.add.graphics().setDepth(12);
  const particles = [];
  for (let i = 0; i < 12; i++) {
    particles.push({
      x: wallX,
      y: impactY + (Math.random() - 0.5) * 40,
      vx: burstDir * (80 + Math.random() * 200),
      vy: -60 + (Math.random() - 0.5) * 180,
      size: 2 + Math.random() * 3,
    });
  }
  scene.tweens.addCounter({
    from: 0, to: 1, duration: 500,
    onUpdate: (tween) => {
      pg.clear();
      const t = tween.getValue();
      particles.forEach(p => {
        p.x += p.vx * 0.016;
        p.y += p.vy * 0.016;
        p.vy += 100 * 0.016;
        pg.fillStyle(color, 1 - t);
        pg.fillCircle(p.x, p.y, p.size * (1 - t * 0.5));
      });
    },
    onComplete: () => pg.destroy()
  });

  // Type-specific extras
  switch (wallSpecialType) {
    case 'wallPinRush': {
      // Rapid multi-hit sparks along wall
      for (let i = 0; i < 5; i++) {
        scene.time.delayedCall(i * 40, () => {
          const sg = scene.add.graphics().setDepth(12);
          const sy = impactY - 20 + i * 10;
          for (let j = 0; j < 4; j++) {
            const a = Math.random() * Math.PI * 2;
            const l = 8 + Math.random() * 12;
            sg.lineStyle(2, 0xffffff, 0.8);
            sg.lineBetween(wallX, sy, wallX + Math.cos(a) * l, sy + Math.sin(a) * l);
          }
          scene.tweens.add({ targets: sg, alpha: 0, duration: 150, onComplete: () => sg.destroy() });
        });
      }
      break;
    }
    case 'wallCrusher': {
      // Large dust cloud + screen flash
      const dust = scene.add.graphics().setDepth(8);
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = 10 + Math.random() * 30;
        dust.fillStyle(0x888888, 0.5);
        dust.fillCircle(wallX + Math.cos(a) * d, impactY + Math.sin(a) * d, 5 + Math.random() * 8);
      }
      scene.tweens.add({ targets: dust, alpha: 0, duration: 600, onComplete: () => dust.destroy() });
      break;
    }
    case 'wallShadowStrike': {
      // Dark slash marks on wall
      const sl = scene.add.graphics().setDepth(12);
      for (let i = 0; i < 3; i++) {
        const a = -0.4 + i * 0.4;
        const l = 25 + Math.random() * 15;
        sl.lineStyle(3, 0xbb44ff, 0.9);
        sl.lineBetween(wallX - Math.cos(a) * l, impactY - Math.sin(a) * l,
                        wallX + Math.cos(a) * l, impactY + Math.sin(a) * l);
      }
      scene.tweens.add({ targets: sl, alpha: 0, duration: 300, onComplete: () => sl.destroy() });
      break;
    }
    case 'wallInferno': {
      // Fire burst at wall
      spawnFireParticles(scene, wallX, impactY, 0xff6600, 14);
      const flame = scene.add.graphics().setDepth(10);
      flame.fillStyle(0xff3300, 0.4);
      flame.fillCircle(wallX, impactY, 35);
      flame.fillStyle(0xffcc00, 0.3);
      flame.fillCircle(wallX, impactY, 20);
      scene.tweens.add({ targets: flame, alpha: 0, duration: 400, onComplete: () => flame.destroy() });
      break;
    }
    case 'wallIcePin': {
      // Ice crystal cage forming at wall
      const ice = scene.add.graphics().setDepth(12);
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i / 5) * Math.PI;
        const r = 30 + Math.random() * 15;
        const px = wallX + Math.cos(a) * r;
        const py = impactY + Math.sin(a) * r;
        const s = 4 + Math.random() * 6;
        ice.fillStyle(0x66ccff, 0.7);
        ice.fillTriangle(px, py - s, px - s * 0.6, py + s * 0.5, px + s * 0.6, py + s * 0.5);
      }
      ice.lineStyle(2, 0xaaeeff, 0.5);
      ice.strokeCircle(wallX, impactY, 35);
      scene.tweens.add({ targets: ice, alpha: 0, duration: 800, onComplete: () => ice.destroy() });
      break;
    }
    case 'wallVoltage': {
      // Lightning cascade along wall
      for (let i = 0; i < 3; i++) {
        const y1 = impactY - 50 + i * 50;
        const y2 = y1 + 40;
        spawnLightningBolt(scene, wallX - 10, y1, wallX + 10, y2, 0xffff00);
      }
      spawnElectricSparks(scene, wallX, impactY, 0xffff00, 10);
      break;
    }
    case 'wallVenomBarrage': {
      // Rapid green slash marks
      for (let i = 0; i < 4; i++) {
        scene.time.delayedCall(i * 50, () => {
          spawnSlashMark(scene, wallX - burstDir * 30, impactY - 15 + i * 10, burstDir, 0x44ff44);
        });
      }
      break;
    }
    case 'wallEarthenCrush': {
      // Large ground crack + rock debris
      spawnGroundCrack(scene, wallX, impactY + 30, 0xaa8855);
      const rocks = scene.add.graphics().setDepth(10);
      for (let i = 0; i < 8; i++) {
        const rx = wallX + (Math.random() - 0.5) * 50;
        const ry = impactY + (Math.random() - 0.5) * 40;
        rocks.fillStyle(0x886644, 0.7);
        rocks.fillRect(rx, ry, 4 + Math.random() * 6, 4 + Math.random() * 6);
      }
      scene.tweens.add({ targets: rocks, alpha: 0, duration: 700, onComplete: () => rocks.destroy() });
      break;
    }
    case 'wallSupernovaPin': {
      // Compressed explosion at wall
      const exp = scene.add.graphics().setDepth(15);
      scene.tweens.addCounter({
        from: 5, to: 50, duration: 300,
        onUpdate: (tween) => {
          exp.clear();
          const r = tween.getValue();
          const t = (r - 5) / 45;
          exp.lineStyle(4, 0xff3366, (1 - t) * 0.9);
          exp.strokeCircle(wallX, impactY, r);
          exp.fillStyle(0xffffff, (1 - t) * 0.3);
          exp.fillCircle(wallX, impactY, r * 0.5);
        },
        onComplete: () => exp.destroy()
      });
      break;
    }
    case 'wallWraithDrive': {
      // Ghostly wisps at impact
      const wisps = scene.add.graphics().setDepth(10);
      scene.tweens.addCounter({
        from: 0, to: 1, duration: 500,
        onUpdate: (tween) => {
          wisps.clear();
          const t = tween.getValue();
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2 + t * 4;
            const r = 15 + t * 25;
            wisps.fillStyle(0xddddff, (1 - t) * 0.5);
            wisps.fillCircle(wallX + Math.cos(a) * r, impactY + Math.sin(a) * r, 4);
          }
        },
        onComplete: () => wisps.destroy()
      });
      break;
    }
  }
}

export function spawnDiveKickTrail(scene, x, y, dir, color) {
  const g = scene.add.graphics().setDepth(7);
  for (let i = 0; i < 5; i++) {
    const px = x - dir * (i * 10) + (Math.random() - 0.5) * 8;
    const py = y - (i * 6) + (Math.random() - 0.5) * 6;
    const size = 2 + Math.random() * 3;
    g.fillStyle(color, 0.5 - i * 0.08);
    g.fillCircle(px, py, size);
    // Diagonal streak line
    g.lineStyle(2, color, 0.4 - i * 0.06);
    g.lineBetween(px, py, px - dir * 12, py - 8);
  }
  scene.tweens.add({ targets: g, alpha: 0, duration: 180, onComplete: () => g.destroy() });
}

export function spawnDiveKickLanding(scene, x, y, color) {
  // Dust burst
  const g = scene.add.graphics().setDepth(8);
  for (let i = 0; i < 8; i++) {
    const angle = Math.PI + (Math.random() - 0.5) * Math.PI;
    const dist = 8 + Math.random() * 18;
    const size = 3 + Math.random() * 4;
    g.fillStyle(0xaaaaaa, 0.5);
    g.fillCircle(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist * 0.4, size);
  }
  scene.tweens.add({ targets: g, alpha: 0, duration: 350, onComplete: () => g.destroy() });

  // Small shockwave ring
  const ring = scene.add.graphics().setDepth(12);
  scene.tweens.addCounter({
    from: 5, to: 40, duration: 250,
    onUpdate: (tween) => {
      ring.clear();
      const r = tween.getValue();
      const t = (r - 5) / 35;
      ring.lineStyle(2, color, (1 - t) * 0.7);
      ring.strokeCircle(x, y, r);
    },
    onComplete: () => ring.destroy()
  });
}

export function spawnGroundCrack(scene, x, y, color = 0x888888) {
  const g = scene.add.graphics().setDepth(3);
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI * 0.8 + (i / 4) * Math.PI * 0.6;
    const len = 25 + Math.random() * 35;
    const midX = x + Math.cos(angle) * len * 0.5 + (Math.random() - 0.5) * 8;
    const midY = y + Math.abs(Math.sin(angle)) * len * 0.2;
    const endX = x + Math.cos(angle) * len + (Math.random() - 0.5) * 12;
    const endY = y + Math.abs(Math.sin(angle)) * len * 0.15;
    g.lineStyle(2, color, 0.7);
    g.lineBetween(x, y, midX, midY);
    g.lineBetween(midX, midY, endX, endY);
  }
  scene.tweens.add({ targets: g, alpha: 0, duration: 1200, onComplete: () => g.destroy() });
}
