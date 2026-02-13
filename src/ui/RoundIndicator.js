import { GAME_CONFIG } from '../config.js';

export class RoundIndicator {
  constructor(scene, x, y, alignRight = false) {
    this.x = x;
    this.y = y;
    this.alignRight = alignRight;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(100);
  }

  update(wins) {
    const g = this.graphics;
    g.clear();

    for (let i = 0; i < GAME_CONFIG.ROUNDS_TO_WIN; i++) {
      const cx = this.alignRight
        ? this.x - i * 25
        : this.x + i * 25;

      if (i < wins) {
        g.fillStyle(0xffcc00, 1);
        g.fillCircle(cx, this.y, 8);
      }
      g.lineStyle(2, 0x666666, 1);
      g.strokeCircle(cx, this.y, 8);
    }
  }

  destroy() {
    this.graphics.destroy();
  }
}
