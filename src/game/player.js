import { Container, Graphics } from 'pixi.js';
import {
  gameBounds, PLAYER_RADIUS, PLAYER_HITBOX_RADIUS,
  PLAYER_SPEED, PLAYER_FOCUS_SPEED, PLAYER_INVULN_TIME,
} from '../utils/constants.js';
import { clamp } from '../utils/math.js';

/**
 * Player character — layered glowing orb with engine glow and focus rings.
 * Hitbox is a tiny 3px dot for fair Touhou-style gameplay.
 */
export class Player {
  constructor() {
    this.x = gameBounds.width / 2;
    this.y = gameBounds.height - 80;
    this.radius = PLAYER_RADIUS;
    this.hitboxRadius = PLAYER_HITBOX_RADIUS;
    this.invulnTimer = 0;
    this.alive = true;
    this.time = 0;

    this.velX = 0;
    this.velY = 0;

    this.container = new Container();
    this.container.zIndex = 100;

    this.gfx = new Graphics();
    this.container.addChild(this.gfx);

    this.hitboxGfx = new Graphics();
    this.hitboxGfx.visible = false;
    this.container.addChild(this.hitboxGfx);

    this._drawStatic();
    this._updatePosition();
  }

  _drawStatic() {
    this.hitboxGfx.clear();
    this.hitboxGfx.circle(0, 0, this.hitboxRadius + 5);
    this.hitboxGfx.stroke({ color: 0xff6b9d, width: 0.5, alpha: 0.25 });
    this.hitboxGfx.circle(0, 0, this.hitboxRadius + 2);
    this.hitboxGfx.stroke({ color: 0xff6b9d, width: 0.5, alpha: 0.4 });
    this.hitboxGfx.circle(0, 0, this.hitboxRadius);
    this.hitboxGfx.fill({ color: 0xff6b9d, alpha: 0.7 });
    this.hitboxGfx.circle(0, 0, this.hitboxRadius * 0.4);
    this.hitboxGfx.fill({ color: 0xffffff, alpha: 0.9 });
  }

  _updatePosition() {
    this.container.position.set(this.x, this.y);
  }

  update(dt, input) {
    if (!this.alive) return;

    this.time += dt;

    const maxSpeed = input.focus ? PLAYER_FOCUS_SPEED : PLAYER_SPEED;
    const accel = 0.45;
    const friction = 0.72;

    let ix = 0, iy = 0;
    if (input.left) ix -= 1;
    if (input.right) ix += 1;
    if (input.up) iy -= 1;
    if (input.down) iy += 1;

    if (ix !== 0 && iy !== 0) {
      const inv = 1 / Math.SQRT2;
      ix *= inv;
      iy *= inv;
    }

    if (ix !== 0) {
      this.velX += ix * accel * dt;
      this.velX = clamp(this.velX, -maxSpeed, maxSpeed);
    } else {
      this.velX *= Math.pow(friction, dt);
      if (Math.abs(this.velX) < 0.05) this.velX = 0;
    }

    if (iy !== 0) {
      this.velY += iy * accel * dt;
      this.velY = clamp(this.velY, -maxSpeed, maxSpeed);
    } else {
      this.velY *= Math.pow(friction, dt);
      if (Math.abs(this.velY) < 0.05) this.velY = 0;
    }

    this.x += this.velX * dt;
    this.y += this.velY * dt;

    const margin = this.radius;
    this.x = clamp(this.x, margin, gameBounds.width - margin);
    this.y = clamp(this.y, margin, gameBounds.height - margin);

    this.hitboxGfx.visible = input.focus;

    if (this.invulnTimer > 0) {
      this.invulnTimer -= dt * (1000 / 60);
      const blink = Math.sin(this.invulnTimer * 0.25);
      this.container.alpha = blink > 0 ? 0.9 : 0.35;
    } else {
      this.container.alpha = 1;
    }

    this._drawBody(input.focus);
    this._updatePosition();
  }

  _drawBody(isFocused) {
    this.gfx.clear();

    const r = this.radius;
    const breath = 0.5 + 0.5 * Math.sin(this.time * 0.04);
    const speed = Math.sqrt(this.velX * this.velX + this.velY * this.velY);
    // Outer aura
    const auraR = r + 8 + breath * 4;
    this.gfx.circle(0, 0, auraR);
    this.gfx.fill({ color: 0x8b7ad8, alpha: 0.06 + breath * 0.025 });

    // Mid ring
    this.gfx.circle(0, 0, r + 3);
    this.gfx.fill({ color: 0xa78bfa, alpha: 0.18 });

    // Main body
    this.gfx.circle(0, 0, r);
    this.gfx.fill({ color: 0xc4b5fd, alpha: 0.92 });

    // Rim stroke
    this.gfx.circle(0, 0, r);
    this.gfx.stroke({ color: 0xe0d4ff, width: 1.2, alpha: 0.6 });

    // Inner glow
    this.gfx.circle(0, 0, r * 0.55);
    this.gfx.fill({ color: 0xe0d4ff, alpha: 0.15 + breath * 0.05 });

    // Bright core
    this.gfx.circle(0, 0, 3.5);
    this.gfx.fill({ color: 0xffffff, alpha: 0.95 });

    // Focus mode — precision rings
    if (isFocused) {
      const rot1 = this.time * 0.015;
      const rot2 = -this.time * 0.012;
      const r1 = r * 1.8;
      const r2 = r * 2.3;
      const segs = 8;
      const gap = 0.12;
      const segArc = (Math.PI * 2 / segs) - gap;
      for (let s = 0; s < segs; s++) {
        const a = rot1 + s * (segArc + gap);
        this.gfx.arc(0, 0, r1, a, a + segArc);
        this.gfx.stroke({ color: 0xc4b5fd, width: 0.8, alpha: 0.18 });
      }
      for (let s = 0; s < segs + 2; s++) {
        const arcLen = Math.PI * 2 / (segs + 2) - gap * 0.8;
        const a = rot2 + s * (arcLen + gap * 0.8);
        this.gfx.arc(0, 0, r2, a, a + arcLen);
        this.gfx.stroke({ color: 0xa78bfa, width: 0.5, alpha: 0.12 });
      }
    }
  }

  hit() {
    if (this.invulnTimer > 0) return false;
    this.invulnTimer = PLAYER_INVULN_TIME;
    return true;
  }

  /**
   * Apply a violent knockback impulse (boss contact, etc.).
   * Overrides current velocity — the player is ejected.
   */
  knockback(vx, vy) {
    this.velX = vx;
    this.velY = vy;
  }

  reset() {
    this.x = gameBounds.width / 2;
    this.y = gameBounds.height - 80;
    this.invulnTimer = 0;
    this.alive = true;
    this.time = 0;
    this.velX = 0;
    this.velY = 0;
    this.container.alpha = 1;
    this._updatePosition();
  }
}
