export class HealthBar {
  constructor(scene, x, y, width, height, playerIndex) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.playerIndex = playerIndex;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(100);
  }

  update(currentHealth, maxHealth) {
    const g = this.graphics;
    g.clear();

    const ratio = Math.max(0, currentHealth / maxHealth);
    const fillWidth = this.width * ratio;
    const isP1 = this.playerIndex === 0;

    // Background
    g.fillStyle(0x333333, 1);
    g.fillRect(this.x, this.y, this.width, this.height);

    // Health color based on ratio
    let color;
    if (ratio > 0.5) color = 0x00cc44;
    else if (ratio > 0.25) color = 0xcccc00;
    else color = 0xcc0000;

    g.fillStyle(color, 1);
    if (isP1) {
      // P1: drains from right to left
      g.fillRect(this.x, this.y, fillWidth, this.height);
    } else {
      // P2: drains from left to right
      g.fillRect(this.x + this.width - fillWidth, this.y, fillWidth, this.height);
    }

    // Border
    g.lineStyle(2, 0xffffff, 1);
    g.strokeRect(this.x, this.y, this.width, this.height);
  }

  destroy() {
    this.graphics.destroy();
  }
}
