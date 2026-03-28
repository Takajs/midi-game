import { Graphics, Container } from 'pixi.js';
import { gameBounds, BULLET_POOL_SIZE, TRAJ } from '../utils/constants.js';
import { noteColor } from '../utils/noteColor.js';

/**
 * Bullet data — struct-of-arrays.
 */
class BulletData {
  constructor(size) {
    this.x         = new Float32Array(size);
    this.y         = new Float32Array(size);
    this.vx        = new Float32Array(size);
    this.vy        = new Float32Array(size);
    this.radius    = new Float32Array(size);
    this.color     = new Uint32Array(size);
    this.alive     = new Uint8Array(size);
    this.age       = new Float32Array(size);
    this.angVel    = new Float32Array(size);
    this.accelX    = new Float32Array(size);
    this.accelY    = new Float32Array(size);
    this.type      = new Uint8Array(size);
    this.param     = new Float32Array(size);
    this.noteVel   = new Float32Array(size);
    this.octave    = new Uint8Array(size);
    this.duration  = new Float32Array(size);
    this.pitch     = new Uint8Array(size);   // pitch class 0-11 → shape
    this.fromBoss  = new Uint8Array(size);   // 1 = boss bullet, 0 = ambient
    this.size      = size;
  }
}

// ─── 12 Shape Renderers ───
// Each pitch class gets a geometrically distinct silhouette.
//
//   C  = Sun (radiating circle)     C# = Diamond
//   D  = Hexagonal crystal          D# = Triangle
//   E  = Five-pointed star          F  = Crescent
//   F# = Cross                      G  = Arrow
//   G# = Petal                      A  = Square
//   A# = Six-pointed star           B  = Teardrop

function drawSun(g, x, y, r, rot, a, col) {
  g.circle(x, y, r * 0.75);
  g.fill({ color: col, alpha: a * 0.8 });
  for (let i = 0; i < 6; i++) {
    const angle = rot + (Math.PI * i) / 3;
    const ix = x + Math.cos(angle) * r * 0.5;
    const iy = y + Math.sin(angle) * r * 0.5;
    const ox = x + Math.cos(angle) * (r + 2);
    const oy = y + Math.sin(angle) * (r + 2);
    g.moveTo(ix, iy);
    g.lineTo(ox, oy);
    g.stroke({ color: col, width: 1, alpha: a * 0.45 });
  }
  g.circle(x, y, r * 0.25);
  g.fill({ color: 0xffffff, alpha: a * 0.6 });
}

function drawDiamond(g, x, y, r, rot, a, col) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const rx = r * 0.55, ry = r;
  g.moveTo(x + c * ry, y + s * ry);
  g.lineTo(x - s * rx, y + c * rx);
  g.lineTo(x - c * ry, y - s * ry);
  g.lineTo(x + s * rx, y - c * rx);
  g.closePath();
  g.fill({ color: col, alpha: a * 0.75 });
  g.moveTo(x + c * ry * 0.35, y + s * ry * 0.35);
  g.lineTo(x - s * rx * 0.3, y + c * rx * 0.3);
  g.lineTo(x - c * ry * 0.15, y - s * ry * 0.15);
  g.closePath();
  g.fill({ color: 0xffffff, alpha: a * 0.25 });
}

function drawHexCrystal(g, x, y, r, rot, a, col) {
  g.moveTo(x + Math.cos(rot) * r, y + Math.sin(rot) * r);
  for (let i = 1; i <= 6; i++) {
    const angle = rot + (Math.PI * 2 * i) / 6;
    g.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
  }
  g.closePath();
  g.fill({ color: col, alpha: a * 0.65 });
  g.moveTo(x + Math.cos(rot) * r * 0.8, y + Math.sin(rot) * r * 0.8);
  g.lineTo(x - Math.cos(rot) * r * 0.8, y - Math.sin(rot) * r * 0.8);
  g.stroke({ color: 0xffffff, width: 0.6, alpha: a * 0.3 });
}

function drawTriangle(g, x, y, r, rot, a, col) {
  g.moveTo(x + Math.cos(rot) * r, y + Math.sin(rot) * r);
  g.lineTo(x + Math.cos(rot + 2.094) * r, y + Math.sin(rot + 2.094) * r);
  g.lineTo(x + Math.cos(rot + 4.189) * r, y + Math.sin(rot + 4.189) * r);
  g.closePath();
  g.fill({ color: col, alpha: a * 0.7 });
  g.circle(x, y, r * 0.2);
  g.fill({ color: 0xffffff, alpha: a * 0.45 });
}

function drawStar5(g, x, y, r, rot, a, col) {
  const outerR = r, innerR = r * 0.4;
  g.moveTo(x + Math.cos(rot) * outerR, y + Math.sin(rot) * outerR);
  for (let i = 1; i <= 10; i++) {
    const angle = rot + (Math.PI * i) / 5;
    const pr = i % 2 === 0 ? outerR : innerR;
    g.lineTo(x + Math.cos(angle) * pr, y + Math.sin(angle) * pr);
  }
  g.closePath();
  g.fill({ color: col, alpha: a * 0.75 });
  g.circle(x, y, r * 0.18);
  g.fill({ color: 0xffffff, alpha: a * 0.5 });
}

function drawCrescent(g, x, y, r, rot, a, col) {
  const cx2 = x + Math.cos(rot + 0.6) * r * 0.45;
  const cy2 = y + Math.sin(rot + 0.6) * r * 0.45;
  g.circle(x, y, r);
  g.fill({ color: col, alpha: a * 0.6 });
  g.circle(cx2, cy2, r * 0.85);
  g.fill({ color: 0x05050e, alpha: a * 0.75 });
  g.circle(x, y, r);
  g.stroke({ color: col, width: 0.8, alpha: a * 0.35 });
}

function drawCross(g, x, y, r, rot, a, col) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const w = r * 0.3, l = r;
  g.moveTo(x + c * l, y + s * l);
  g.lineTo(x + c * l - s * w, y + s * l + c * w);
  g.lineTo(x - c * l - s * w, y - s * l + c * w);
  g.lineTo(x - c * l + s * w, y - s * l - c * w);
  g.lineTo(x + c * l + s * w, y + s * l - c * w);
  g.closePath();
  g.fill({ color: col, alpha: a * 0.7 });
  g.moveTo(x + s * l, y - c * l);
  g.lineTo(x + s * l + c * w, y - c * l + s * w);
  g.lineTo(x - s * l + c * w, y + c * l + s * w);
  g.lineTo(x - s * l - c * w, y + c * l - s * w);
  g.lineTo(x + s * l - c * w, y - c * l - s * w);
  g.closePath();
  g.fill({ color: col, alpha: a * 0.7 });
  g.circle(x, y, r * 0.2);
  g.fill({ color: 0xffffff, alpha: a * 0.4 });
}

function drawArrow(g, x, y, r, rot, a, col) {
  const c = Math.cos(rot), s = Math.sin(rot);
  g.moveTo(x + c * r * 1.2, y + s * r * 1.2);
  g.lineTo(x - c * r * 0.6 + s * r * 0.5, y - s * r * 0.6 - c * r * 0.5);
  g.lineTo(x - c * r * 0.2, y - s * r * 0.2);
  g.lineTo(x - c * r * 0.6 - s * r * 0.5, y - s * r * 0.6 + c * r * 0.5);
  g.closePath();
  g.fill({ color: col, alpha: a * 0.75 });
  g.circle(x + c * r * 0.3, y + s * r * 0.3, r * 0.15);
  g.fill({ color: 0xffffff, alpha: a * 0.5 });
}

function drawPetal(g, x, y, r, rot, a, col) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const tip = { x: x + c * r * 1.3, y: y + s * r * 1.3 };
  const base = { x: x - c * r * 0.4, y: y - s * r * 0.4 };
  const cp1 = { x: x + s * r * 0.8, y: y - c * r * 0.8 };
  const cp2 = { x: x - s * r * 0.8, y: y + c * r * 0.8 };
  g.moveTo(base.x, base.y);
  g.quadraticCurveTo(cp1.x, cp1.y, tip.x, tip.y);
  g.quadraticCurveTo(cp2.x, cp2.y, base.x, base.y);
  g.closePath();
  g.fill({ color: col, alpha: a * 0.7 });
  g.circle(x, y, r * 0.2);
  g.fill({ color: 0xffffff, alpha: a * 0.4 });
}

function drawSquare(g, x, y, r, rot, a, col) {
  const r2 = r * 0.85;
  for (let i = 0; i < 4; i++) {
    const angle = rot + Math.PI / 4 + (Math.PI * i) / 2;
    const method = i === 0 ? 'moveTo' : 'lineTo';
    g[method](x + Math.cos(angle) * r2, y + Math.sin(angle) * r2);
  }
  g.closePath();
  g.fill({ color: col, alpha: a * 0.7 });
  for (let i = 0; i < 4; i++) {
    const angle = rot + (Math.PI * i) / 2;
    const method = i === 0 ? 'moveTo' : 'lineTo';
    g[method](x + Math.cos(angle) * r2 * 0.4, y + Math.sin(angle) * r2 * 0.4);
  }
  g.closePath();
  g.fill({ color: 0xffffff, alpha: a * 0.2 });
}

function drawStar6(g, x, y, r, rot, a, col) {
  const outerR = r, innerR = r * 0.5;
  g.moveTo(x + Math.cos(rot) * outerR, y + Math.sin(rot) * outerR);
  for (let i = 1; i <= 12; i++) {
    const angle = rot + (Math.PI * i) / 6;
    const pr = i % 2 === 0 ? outerR : innerR;
    g.lineTo(x + Math.cos(angle) * pr, y + Math.sin(angle) * pr);
  }
  g.closePath();
  g.fill({ color: col, alpha: a * 0.7 });
  g.circle(x, y, r * 0.2);
  g.fill({ color: 0xffffff, alpha: a * 0.55 });
}

function drawTeardrop(g, x, y, r, rot, a, col) {
  const c = Math.cos(rot), s = Math.sin(rot);
  g.circle(x + c * r * 0.2, y + s * r * 0.2, r * 0.6);
  g.fill({ color: col, alpha: a * 0.7 });
  g.moveTo(x + c * r * 0.2 + s * r * 0.5, y + s * r * 0.2 - c * r * 0.5);
  g.lineTo(x - c * r * 1.3, y - s * r * 1.3);
  g.lineTo(x + c * r * 0.2 - s * r * 0.5, y + s * r * 0.2 + c * r * 0.5);
  g.closePath();
  g.fill({ color: col, alpha: a * 0.55 });
  g.circle(x + c * r * 0.3, y + s * r * 0.3, r * 0.18);
  g.fill({ color: 0xffffff, alpha: a * 0.5 });
}

const SHAPES = [
  drawSun, drawDiamond, drawHexCrystal, drawTriangle,
  drawStar5, drawCrescent, drawCross, drawArrow,
  drawPetal, drawSquare, drawStar6, drawTeardrop,
];

/**
 * BulletSystem — free-list allocation for O(1) spawn, highWater for minimal iteration.
 */
export class BulletSystem {
  constructor() {
    this.data = new BulletData(BULLET_POOL_SIZE);
    this.activeCount = 0;
    this.container = new Container();
    this.container.zIndex = 50;

    this.trailGfx = new Graphics();
    this.bodyGfx = new Graphics();
    this.container.addChild(this.trailGfx);
    this.container.addChild(this.bodyGfx);

    // Theme color tint (0 = no tint)
    this.tintColor = 0;
    this.tintBlend = 0;

    // ── Free-list: O(1) spawn instead of O(n) scan ──
    this.freeStack = new Int32Array(BULLET_POOL_SIZE);
    this.freeCount = BULLET_POOL_SIZE;
    for (let i = 0; i < BULLET_POOL_SIZE; i++) {
      this.freeStack[i] = BULLET_POOL_SIZE - 1 - i; // top of stack = index 0
    }

    // ── High-water mark: only iterate up to this index ──
    this.highWater = 0;
  }

  spawn(x, y, vx, vy, radius, midiNote, type = 0, angVel = 0,
        accelX = 0, accelY = 0, param = 0,
        noteVel = 0.5, octave = 4, duration = 0.2, fromBoss = 0) {
    if (this.freeCount === 0) return -1;

    // Pop from free stack — O(1)
    const idx = this.freeStack[--this.freeCount];
    const d = this.data;

    d.x[idx]       = x;
    d.y[idx]       = y;
    d.vx[idx]      = vx;
    d.vy[idx]      = vy;
    d.radius[idx]  = radius;
    d.color[idx]   = this.tintBlend > 0
      ? this._blendColor(noteColor(midiNote), this.tintColor, this.tintBlend)
      : noteColor(midiNote);
    d.alive[idx]   = 1;
    d.age[idx]     = 0;
    d.angVel[idx]  = angVel;
    d.accelX[idx]  = accelX;
    d.accelY[idx]  = accelY;
    d.type[idx]    = type;
    d.param[idx]   = param;
    d.noteVel[idx] = noteVel;
    d.octave[idx]  = octave;
    d.duration[idx] = duration;
    d.pitch[idx]   = midiNote % 12;
    d.fromBoss[idx] = fromBoss;
    this.activeCount++;

    // Expand high-water mark
    if (idx >= this.highWater) this.highWater = idx + 1;
    return idx;
  }

  _kill(idx) {
    this.data.alive[idx] = 0;
    this.freeStack[this.freeCount++] = idx; // Push back to free stack
  }

  // ─── Physics ───

  update(dt, playerX, playerY) {
    const d = this.data;
    const margin = 60;
    const wMax = gameBounds.width + margin;
    const hMax = gameBounds.height + margin;
    let active = 0;
    let newHighWater = 0;

    for (let i = 0; i < this.highWater; i++) {
      if (!d.alive[i]) continue;
      d.age[i] += dt;
      const age = d.age[i];

      switch (d.type[i]) {
        case TRAJ.WAVY:
          d.vx[i] = d.param[i] * Math.sin(age * 0.08);
          break;
        case TRAJ.ACCEL:
          d.vx[i] += d.accelX[i] * dt;
          d.vy[i] += d.accelY[i] * dt;
          break;
        case TRAJ.HOMING:
          if (age < 35) {
            const ax = playerX - d.x[i];
            const ay = playerY - d.y[i];
            const dist = Math.sqrt(ax * ax + ay * ay) || 1;
            d.vx[i] += (ax / dist) * 0.04 * dt;
            d.vy[i] += (ay / dist) * 0.04 * dt;
          }
          break;
        case TRAJ.DECEL:
          if (age < 22) {
            d.vx[i] *= 0.97;
            d.vy[i] *= 0.97;
          } else if (age >= 25 && age < 30) {
            const sp = Math.sqrt(d.vx[i] * d.vx[i] + d.vy[i] * d.vy[i]) || 0.01;
            const target = d.param[i] || 2;
            d.vx[i] += (d.vx[i] / sp) * target * 0.12 * dt;
            d.vy[i] += (d.vy[i] / sp) * target * 0.12 * dt;
          }
          break;
        case TRAJ.SINE_ARC:
          d.vx[i] += d.param[i] * Math.cos(age * 0.06) * 0.06 * dt;
          break;
        case TRAJ.BOOMERANG:
          if (age < 20) {
            d.vx[i] *= 0.98;
            d.vy[i] *= 0.98;
          } else if (age >= 20 && age < 24) {
            d.vy[i] *= -0.03 * dt + 1;
          }
          break;
      }

      if (d.angVel[i] !== 0) {
        const c = Math.cos(d.angVel[i] * dt);
        const s = Math.sin(d.angVel[i] * dt);
        const nvx = d.vx[i] * c - d.vy[i] * s;
        const nvy = d.vx[i] * s + d.vy[i] * c;
        d.vx[i] = nvx;
        d.vy[i] = nvy;
      }

      d.x[i] += d.vx[i] * dt;
      d.y[i] += d.vy[i] * dt;

      if (d.x[i] < -margin || d.x[i] > wMax || d.y[i] < -margin || d.y[i] > hMax) {
        this._kill(i);
        continue;
      }
      active++;
      newHighWater = i + 1;
    }
    this.activeCount = active;
    this.highWater = newHighWater;
  }

  // ─── Render ───

  render() {
    const d = this.data;
    const tg = this.trailGfx;
    const bg = this.bodyGfx;
    tg.clear();
    bg.clear();

    for (let i = 0; i < this.highWater; i++) {
      if (!d.alive[i]) continue;

      const bx = d.x[i], by = d.y[i];
      const r = d.radius[i];
      const age = d.age[i];
      const vel = d.noteVel[i];
      const oct = d.octave[i];
      const dur = d.duration[i];
      const color = d.color[i];
      const pitch = d.pitch[i];
      const isBoss = d.fromBoss[i];
      const vx = d.vx[i], vy = d.vy[i];
      const speed = Math.sqrt(vx * vx + vy * vy);

      // ── Birth burst: bullets pop in at 1.4× and settle to 1× over 6 frames ──
      const birthScale = age < 6 ? 1 + (1 - age / 6) * 0.4 : 1;
      const fadeIn = Math.min(1, age / 7);

      const travelAngle = speed > 0.2 ? Math.atan2(vy, vx) : age * 0.03;
      const pulse = 1 + Math.sin(age * (0.06 + pitch * 0.008)) * 0.08;
      const pr = r * pulse * birthScale;

      // ── Trail ──
      if (speed > 0.2 && age > 2) {
        const octFactor = oct <= 2 ? 1.4 : oct <= 4 ? 1.0 : 0.55;
        const durFactor = 0.5 + Math.min(dur, 2) * 0.5;
        const bossFactor = isBoss ? 1.3 : 1;
        const trailLen = (4 + speed * 3.5) * octFactor * durFactor * bossFactor;
        const nx = vx / speed, ny = vy / speed;

        tg.moveTo(bx, by);
        tg.lineTo(bx - nx * trailLen, by - ny * trailLen);
        tg.stroke({ color, width: Math.max(0.5, pr * (isBoss ? 0.55 : 0.45)),
          alpha: fadeIn * (isBoss ? 0.22 : 0.16) * (0.5 + vel * 0.5), cap: 'round' });
      }

      // ── Outer glow (boss bullets get stronger glow) ──
      if (isBoss) {
        const glowR = pr + (oct <= 2 ? 8 : oct <= 4 ? 5 : 3);
        bg.circle(bx, by, glowR);
        bg.fill({ color, alpha: fadeIn * (oct <= 2 ? 0.06 : 0.035) });
      } else {
        const glowR = pr + (oct <= 2 ? 4 : oct <= 4 ? 2 : 0.5);
        bg.circle(bx, by, glowR);
        bg.fill({ color, alpha: fadeIn * (oct <= 2 ? 0.03 : 0.015) });
      }

      // ── Shape ──
      const a = fadeIn * (0.5 + vel * 0.4);
      SHAPES[pitch](bg, bx, by, pr, travelAngle, a, color);

      // ── High-velocity pulse ring ──
      if (vel > 0.8) {
        const ring = pr + 2.5 + Math.sin(age * 0.15) * 1.5;
        bg.circle(bx, by, ring);
        bg.stroke({ color: 0xffffff, width: isBoss ? 0.9 : 0.6, alpha: fadeIn * 0.1 * vel });
      }

      // ── Birth ring (visible pop on spawn, especially for boss) ──
      if (age < 4 && isBoss) {
        const birthRing = r * (2.5 - age * 0.4);
        bg.circle(bx, by, birthRing);
        bg.stroke({ color, width: 1, alpha: (1 - age / 4) * 0.3 });
      }
    }
  }

  checkCollision(px, py, hitboxRadius) {
    const d = this.data;
    for (let i = 0; i < this.highWater; i++) {
      if (!d.alive[i]) continue;
      const dx = d.x[i] - px, dy = d.y[i] - py;
      const minDist = d.radius[i] + hitboxRadius;
      if (dx * dx + dy * dy < minDist * minDist) {
        this._kill(i);
        this.activeCount--;
        return true;
      }
    }
    return false;
  }

  _blendColor(c1, c2, t) {
    const r = Math.round(((c1 >> 16) & 0xff) * (1 - t) + ((c2 >> 16) & 0xff) * t);
    const g = Math.round(((c1 >> 8) & 0xff) * (1 - t) + ((c2 >> 8) & 0xff) * t);
    const b = Math.round((c1 & 0xff) * (1 - t) + (c2 & 0xff) * t);
    return (r << 16) | (g << 8) | b;
  }

  clearAll() {
    const d = this.data;
    for (let i = 0; i < this.highWater; i++) {
      if (d.alive[i]) {
        this._kill(i);
      }
    }
    this.activeCount = 0;
    this.highWater = 0;
  }
}
