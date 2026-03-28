import { Graphics, Container } from 'pixi.js';
import { gameBounds } from '../utils/constants.js';

/**
 * Spectacle engine — thunderbolts, lightbeams, gravity wells, screen shake.
 *
 * Thunderbolts:  Full-screen vertical lightning pillars. Triggered by
 *                impactful bass notes. Multiple jagged branches.
 * Lightbeams:    Vertical columns for sustained notes with pulsing warnings.
 * Gravity wells: Bass notes that warp bullet trajectories.
 * Screen shake:  Bass impacts jolt the world.
 */

const MAX_BOLTS = 8;
const MAX_BEAMS = 10;
const MAX_WELLS = 6;

export class EffectsSystem {
  constructor() {
    this.container = new Container();
    this.container.zIndex = 55;

    this.beamGfx = new Graphics();
    this.boltGfx = new Graphics();
    this.wellGfx = new Graphics();
    this.bombGfx = new Graphics();
    this.container.addChild(this.beamGfx);
    this.container.addChild(this.wellGfx);
    this.container.addChild(this.boltGfx);
    this.container.addChild(this.bombGfx);

    this.bolts = [];
    this.beams = [];
    this.wells = [];
    this.bombRing = null;

    this.shakeIntensity = 0;
  }

  // ─── Thunderbolt: full-screen vertical lightning pillar ───

  addBolt(x, color) {
    if (this.bolts.length >= MAX_BOLTS) return;
    const h = gameBounds.height;
    // Main trunk: top to bottom
    const trunk = this._lightning(x, 0, x + (Math.random() - 0.5) * 30, h, 5);
    // 2-4 branches splitting off the trunk
    const branches = [];
    const branchCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < branchCount; i++) {
      const srcIdx = Math.floor(trunk.length * (0.15 + Math.random() * 0.6));
      const src = trunk[srcIdx];
      const dir = Math.random() > 0.5 ? 1 : -1;
      const endX = src.x + dir * (40 + Math.random() * 100);
      const endY = src.y + 40 + Math.random() * 120;
      branches.push(this._lightning(src.x, src.y, endX, Math.min(endY, h), 3));
    }
    this.bolts.push({ trunk, branches, life: 16, maxLife: 16, color, x });
  }

  _lightning(x1, y1, x2, y2, depth) {
    let pts = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
    for (let d = 0; d < depth; d++) {
      const next = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const off = (Math.random() - 0.5) * len * 0.3;
        next.push({
          x: (a.x + b.x) / 2 + (-dy / len) * off,
          y: (a.y + b.y) / 2 + (dx / len) * off,
        });
        next.push(b);
      }
      pts = next;
    }
    return pts;
  }

  // ─── Lightbeam ───

  addBeam(x, width, warmupFrames, activeFrames, color) {
    if (this.beams.length >= MAX_BEAMS) return;
    this.beams.push({
      x, width, color,
      warmup: warmupFrames, maxWarmup: warmupFrames,
      active: activeFrames, maxActive: activeFrames,
      state: 'warming',
    });
  }

  // ─── Gravity well ───

  addWell(x, y, strength, life) {
    if (this.wells.length >= MAX_WELLS) return;
    this.wells.push({ x, y, strength, life, maxLife: life });
  }

  // ─── Screen shake ───

  shake(intensity) {
    this.shakeIntensity = Math.min(this.shakeIntensity + intensity, 10);
  }

  // ─── Apply gravity wells to bullets ───

  applyWells(bulletData) {
    for (const w of this.wells) {
      const t = w.life / w.maxLife;
      const str = w.strength * t;
      for (let i = 0; i < bulletData.size; i++) {
        if (!bulletData.alive[i]) continue;
        const dx = w.x - bulletData.x[i];
        const dy = w.y - bulletData.y[i];
        const distSq = dx * dx + dy * dy;
        if (distSq < 25 || distSq > 90000) continue;
        const dist = Math.sqrt(distSq);
        const force = str / (dist * 0.5);
        bulletData.vx[i] += (dx / dist) * force * 0.008;
        bulletData.vy[i] += (dy / dist) * force * 0.008;
      }
    }
  }

  // ─── Update ───

  update(dt, stageContainer) {
    // Shake
    if (this.shakeIntensity > 0.15) {
      const sx = (Math.random() - 0.5) * this.shakeIntensity * 2;
      const sy = (Math.random() - 0.5) * this.shakeIntensity * 2;
      this.shakeIntensity *= 0.87;
      stageContainer.position.set(sx, sy);
    } else if (this.shakeIntensity > 0) {
      this.shakeIntensity = 0;
      stageContainer.position.set(0, 0);
    }

    for (let i = this.bolts.length - 1; i >= 0; i--) {
      this.bolts[i].life -= dt;
      if (this.bolts[i].life <= 0) this.bolts.splice(i, 1);
    }

    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      if (b.state === 'warming') {
        b.warmup -= dt;
        if (b.warmup <= 0) b.state = 'active';
      } else {
        b.active -= dt;
        if (b.active <= 0) this.beams.splice(i, 1);
      }
    }

    for (let i = this.wells.length - 1; i >= 0; i--) {
      this.wells[i].life -= dt;
      if (this.wells[i].life <= 0) this.wells.splice(i, 1);
    }

    // Bomb ring expansion
    if (this.bombRing) {
      const br = this.bombRing;
      br.life -= dt;
      // Expand to cover full screen diagonal in ~30 frames
      const maxR = Math.sqrt(gameBounds.width ** 2 + gameBounds.height ** 2) * 0.6;
      const progress = 1 - br.life / br.maxLife;
      // Ease-out expansion (fast start, gentle end)
      br.radius = maxR * (1 - Math.pow(1 - progress, 2.5));
      if (br.life <= 0) this.bombRing = null;
    }
  }

  // ─── Render ───

  render() {
    this.boltGfx.clear();
    this.beamGfx.clear();
    this.wellGfx.clear();
    this.bombGfx.clear();
    const h = gameBounds.height;

    // ── Beams ──
    for (const b of this.beams) {
      if (b.state === 'warming') {
        const t = 1 - b.warmup / b.maxWarmup;
        const pulse = 0.2 + 0.3 * Math.sin(t * Math.PI * 10);
        const lineW = 1 + t * 5;
        this.beamGfx.moveTo(b.x, 0);
        this.beamGfx.lineTo(b.x, h);
        this.beamGfx.stroke({ color: b.color, width: lineW, alpha: pulse });
        // Growing edge markers top + bottom
        const mw = b.width * t * 0.5;
        this.beamGfx.rect(b.x - mw, 0, mw * 2, 5);
        this.beamGfx.fill({ color: b.color, alpha: pulse * 0.6 });
        this.beamGfx.rect(b.x - mw, h - 5, mw * 2, 5);
        this.beamGfx.fill({ color: b.color, alpha: pulse * 0.4 });
        // Scanning dot
        const scanY = (t * 4 % 1) * h;
        this.beamGfx.circle(b.x, scanY, 3 + t * 5);
        this.beamGfx.fill({ color: 0xffffff, alpha: pulse * 0.5 });
      } else {
        const t = Math.max(0, b.active / b.maxActive);
        const w = b.width * (0.4 + t * 0.6);
        this.beamGfx.rect(b.x - w, 0, w * 2, h);
        this.beamGfx.fill({ color: b.color, alpha: t * 0.05 });
        this.beamGfx.rect(b.x - w * 0.35, 0, w * 0.7, h);
        this.beamGfx.fill({ color: b.color, alpha: t * 0.12 });
        for (const sign of [-1, 1]) {
          this.beamGfx.moveTo(b.x + w * 0.35 * sign, 0);
          this.beamGfx.lineTo(b.x + w * 0.35 * sign, h);
          this.beamGfx.stroke({ color: 0xffffff, width: 1.5, alpha: t * 0.3 });
        }
        this.beamGfx.moveTo(b.x, 0);
        this.beamGfx.lineTo(b.x, h);
        this.beamGfx.stroke({ color: 0xffffff, width: 1, alpha: t * 0.2 });
      }
    }

    // ── Thunderbolts ──
    for (const bolt of this.bolts) {
      const t = bolt.life / bolt.maxLife;
      // Glow layer
      this._drawChain(this.boltGfx, bolt.trunk, bolt.color, 6, t * 0.1);
      for (const br of bolt.branches) {
        this._drawChain(this.boltGfx, br, bolt.color, 3.5, t * 0.07);
      }
      // Core layer
      this._drawChain(this.boltGfx, bolt.trunk, 0xffffff, 2, t * 0.8);
      for (const br of bolt.branches) {
        this._drawChain(this.boltGfx, br, 0xffffff, 1.2, t * 0.5);
      }
      // Thin inner
      this._drawChain(this.boltGfx, bolt.trunk, 0xffffff, 0.8, t * 0.95);
    }

    // ── Wells ──
    for (const w of this.wells) {
      const t = w.life / w.maxLife;
      const maxR = 60 + w.strength * 20;
      for (let ring = 0; ring < 4; ring++) {
        const phase = w.life * 0.08 + ring * 1.5;
        const r = maxR * (0.2 + ring * 0.22) * (1 + Math.sin(phase) * 0.12);
        this.wellGfx.circle(w.x, w.y, r);
        this.wellGfx.stroke({ color: 0x7755cc, width: 0.8, alpha: t * 0.1 * (1 - ring * 0.2) });
      }
      this.wellGfx.circle(w.x, w.y, 3 + t * 2);
      this.wellGfx.fill({ color: 0x9966ff, alpha: t * 0.18 });
    }

    // ── Bomb ring ──
    if (this.bombRing) {
      const br = this.bombRing;
      const t = br.life / br.maxLife;
      // Outer glow ring
      this.bombGfx.circle(br.x, br.y, br.radius);
      this.bombGfx.stroke({ color: 0xaaccff, width: 4 + t * 8, alpha: t * 0.5 });
      // Inner bright ring
      this.bombGfx.circle(br.x, br.y, br.radius * 0.97);
      this.bombGfx.stroke({ color: 0xffffff, width: 2 + t * 3, alpha: t * 0.7 });
      // Faint fill
      this.bombGfx.circle(br.x, br.y, br.radius);
      this.bombGfx.fill({ color: 0xaaccff, alpha: t * 0.03 });
    }
  }

  _drawChain(g, pts, color, width, alpha) {
    if (pts.length < 2 || alpha < 0.005) return;
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      g.lineTo(pts[i].x, pts[i].y);
    }
    g.stroke({ color, width, alpha, cap: 'round', join: 'round' });
  }

  // ─── Collision ───

  checkCollision(px, py, hitboxR) {
    // Beam collision
    for (const b of this.beams) {
      if (b.state !== 'active') continue;
      const t = b.active / b.maxActive;
      const halfW = b.width * (0.4 + t * 0.6) * 0.35;
      if (Math.abs(px - b.x) < halfW + hitboxR) return true;
    }
    // Bolt collision: check proximity to trunk line
    for (const bolt of this.bolts) {
      if (bolt.life / bolt.maxLife < 0.2) continue;
      // Simple: check if player is within ~15px of the bolt's X
      if (Math.abs(px - bolt.x) < 12 + hitboxR) {
        // And within screen bounds
        if (py > 0 && py < gameBounds.height) return true;
      }
    }
    return false;
  }

  // ─── Bomb ring ───

  addBombRing(x, y) {
    this.bombRing = { x, y, radius: 0, life: 30, maxLife: 30 };
  }

  /**
   * Returns current bomb ring radius (or 0 if inactive).
   * game.js uses this to clear bullets inside the ring.
   */
  getBombRingRadius() {
    return this.bombRing ? this.bombRing.radius : 0;
  }

  getBombRingPos() {
    return this.bombRing ? { x: this.bombRing.x, y: this.bombRing.y } : null;
  }

  clear() {
    this.bolts.length = 0;
    this.beams.length = 0;
    this.wells.length = 0;
    this.shakeIntensity = 0;
    this.bombRing = null;
  }
}
