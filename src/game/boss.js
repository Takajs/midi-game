import { Graphics, Container } from 'pixi.js';
import { gameBounds } from '../utils/constants.js';
import { noteColor } from '../utils/noteColor.js';
import { lerp, clamp } from '../utils/math.js';

/**
 * Boss entity — a living cosmic eye that fires from its pupil.
 *
 * The pupil tracks the player. ALL bullets originate from the pupil.
 * During intense sections, mandala spins fast with color shifts.
 * Boss slightly dodges incoming player bullets.
 */

export class Boss {
  constructor() {
    this.container = new Container();
    this.container.zIndex = 45;

    this.auraGfx = new Graphics();
    this.shieldGfx = new Graphics();
    this.mandalaGfx = new Graphics();
    this.coreGfx = new Graphics();
    this.emitGfx = new Graphics();

    this.container.addChild(this.auraGfx);
    this.container.addChild(this.shieldGfx);
    this.container.addChild(this.mandalaGfx);
    this.container.addChild(this.coreGfx);
    this.container.addChild(this.emitGfx);

    // State
    this.x = gameBounds.width * 0.5;
    this.y = gameBounds.height * 0.2;
    this.radius = 60;
    this.color = 0x8866ff;
    this.voices = 5;

    // Player tracking
    this.playerX = gameBounds.width * 0.5;
    this.playerY = gameBounds.height * 0.8;
    this.aimAngle = Math.PI / 2;
    this.pupilDist = 0;

    // Eye position (= bullet origin)
    this.eyeX = this.x;
    this.eyeY = this.y;

    // Animation
    this.time = 0;
    this.shieldAngle = 0;
    this.fireIntensity = 0;

    // Intensity level (from song analysis density)
    this.intensity = 0;

    // Micro-sway
    this.swayX = 0;
    this.swayY = 0;
    this.swayVx = 0;
    this.swayVy = 0;

    // Dodge: impulse from incoming player bullets
    this.dodgeX = 0;
    this.dodgeY = 0;

    // Hit flash (when player hits the boss)
    this.hitFlash = 0;

    // Emit flashes
    this.emitFlashes = [];
    this.maxFlashes = 24;

    this.script = null;
    this.midiMin = 0;
    this.midiMax = 127;
  }

  setScript(analysis, midiMin, midiMax) {
    this.script = analysis;
    this.midiMin = midiMin;
    this.midiMax = midiMax;
  }

  getEmitPoint() {
    return { x: this.eyeX, y: this.eyeY, angle: this.aimAngle };
  }

  flashEmit(midiNote, velocity) {
    const color = noteColor(midiNote);
    if (this.emitFlashes.length >= this.maxFlashes) this.emitFlashes.shift();
    this.emitFlashes.push({
      x: this.eyeX, y: this.eyeY, color,
      life: 12, maxLife: 12, velocity: velocity || 0.5,
    });
    this.fireIntensity = Math.min(this.fireIntensity + 0.25 + (velocity || 0.5) * 0.45, 1.0);
  }

  /**
   * Nudge boss away from an incoming player bullet.
   * Called from game.js each frame for nearby player shots.
   */
  dodge(bulletX, bulletY) {
    const dx = this.x - bulletX;
    const dy = this.y - bulletY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const strength = 0.3; // subtle dodge
    this.dodgeX += (dx / dist) * strength;
    this.dodgeY += (dy / dist) * strength;
  }

  /**
   * Check if a point hits the boss. Returns null or { points, isEye }.
   */
  checkHit(bx, by, shotRadius) {
    const coreR = this.radius * 0.32;
    const pupilR = coreR * 0.35;

    // Eye hit (high value)
    const edx = bx - this.eyeX, edy = by - this.eyeY;
    if (edx * edx + edy * edy < (pupilR + shotRadius) * (pupilR + shotRadius)) {
      this.hitFlash = 1.0;
      return { points: 500, isEye: true };
    }

    // Body hit (lower value)
    const bdx = bx - this.x, bdy = by - this.y;
    if (bdx * bdx + bdy * bdy < (this.radius + shotRadius) * (this.radius + shotRadius)) {
      this.hitFlash = 0.5;
      return { points: 100, isEye: false };
    }

    return null;
  }

  update(dt, currentTime, playerX, playerY) {
    this.time += dt;
    this.shieldAngle += 0.012 * dt;
    this.playerX = playerX;
    this.playerY = playerY;

    // Interpolate from script
    let baseX = this.x, baseY = this.y;
    if (this.script) {
      const ws = this.script.windowSize;
      const N = this.script.windowCount;
      const fi = currentTime / ws;
      const i0 = clamp(Math.floor(fi), 0, N - 1);
      const i1 = Math.min(i0 + 1, N - 1);
      const frac = fi - i0;

      baseX = lerp(this.script.bossX[i0], this.script.bossX[i1], frac);
      baseY = lerp(this.script.bossY[i0], this.script.bossY[i1], frac);
      this.radius = lerp(this.script.bossRadius[i0], this.script.bossRadius[i1], frac);
      this.color = this.script.bossColor[i0];
      this.voices = this.script.bossVoices[i0];

      // Track intensity from density
      this.intensity = lerp(this.intensity,
        this.script.density[i0], 0.08 * dt);
    }

    // Micro-sway
    if (Math.random() < 0.03 * dt) {
      this.swayVx += (Math.random() - 0.5) * 0.6;
      this.swayVy += (Math.random() - 0.5) * 0.4;
    }
    if (this.fireIntensity > 0.3) {
      const kickAngle = this.aimAngle + Math.PI;
      this.swayVx += Math.cos(kickAngle) * this.fireIntensity * 0.15;
      this.swayVy += Math.sin(kickAngle) * this.fireIntensity * 0.1;
    }
    this.swayVx += -this.swayX * 0.02 * dt;
    this.swayVy += -this.swayY * 0.02 * dt;
    this.swayVx *= Math.pow(0.94, dt);
    this.swayVy *= Math.pow(0.94, dt);
    this.swayX += this.swayVx * dt;
    this.swayY += this.swayVy * dt;
    this.swayX = clamp(this.swayX, -25, 25);
    this.swayY = clamp(this.swayY, -15, 15);

    // Dodge decay
    this.dodgeX *= Math.pow(0.85, dt);
    this.dodgeY *= Math.pow(0.85, dt);
    if (Math.abs(this.dodgeX) < 0.01) this.dodgeX = 0;
    if (Math.abs(this.dodgeY) < 0.01) this.dodgeY = 0;

    // Player-reactive lean
    const dx = playerX - baseX;
    const dy = playerY - baseY;
    const distToPlayer = Math.sqrt(dx * dx + dy * dy) || 1;
    const leanFactor = Math.min(0.08, 30 / distToPlayer);

    this.x = baseX + this.swayX + dx * leanFactor + this.dodgeX;
    this.y = baseY + this.swayY + dy * leanFactor + this.dodgeY;

    const margin = this.radius * 0.3;
    this.x = clamp(this.x, margin, gameBounds.width - margin);
    this.y = clamp(this.y, margin, gameBounds.height - margin);

    // Smooth aim
    const targetAngle = Math.atan2(playerY - this.y, playerX - this.x);
    let angleDiff = targetAngle - this.aimAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.aimAngle += angleDiff * 0.18 * dt;

    // Pupil position
    const coreR = this.radius * 0.32;
    const maxPupilDist = coreR * 0.65;
    const targetPupilDist = maxPupilDist * (1 - 12 / (distToPlayer + 12));
    this.pupilDist = lerp(this.pupilDist, targetPupilDist, 0.15 * dt);
    this.eyeX = this.x + Math.cos(this.aimAngle) * this.pupilDist;
    this.eyeY = this.y + Math.sin(this.aimAngle) * this.pupilDist;

    // Decay
    this.fireIntensity *= Math.pow(0.86, dt);
    if (this.fireIntensity < 0.01) this.fireIntensity = 0;
    this.hitFlash *= Math.pow(0.82, dt);
    if (this.hitFlash < 0.01) this.hitFlash = 0;

    for (let i = this.emitFlashes.length - 1; i >= 0; i--) {
      this.emitFlashes[i].life -= dt;
      if (this.emitFlashes[i].life <= 0) this.emitFlashes.splice(i, 1);
    }
  }

  render(playerX, playerY) {
    this.auraGfx.clear();
    this.shieldGfx.clear();
    this.mandalaGfx.clear();
    this.coreGfx.clear();
    this.emitGfx.clear();

    const { x, y, radius: r, color, voices, time, shieldAngle,
            fireIntensity, intensity, hitFlash } = this;

    // ── 1. Aura — 6 concentric rings, pulsing outward ──
    for (let i = 5; i >= 0; i--) {
      const aR = r * (1.5 + i * 0.3);
      const beatPulse = 1 + fireIntensity * 0.25;
      const pulse = beatPulse + Math.sin(time * 0.04 + i * 1.0) * 0.06;
      this.auraGfx.circle(x, y, aR * pulse);
      this.auraGfx.fill({ color, alpha: (0.025 - i * 0.003) + fireIntensity * 0.01 });
    }

    // Pulsing outer ring (expands/contracts with fire)
    if (fireIntensity > 0.1) {
      const pulseR = r * (2.8 + fireIntensity * 1.2 + Math.sin(time * 0.1) * 0.15);
      this.auraGfx.circle(x, y, pulseR);
      this.auraGfx.stroke({ color, width: 1 + fireIntensity * 2, alpha: fireIntensity * 0.12 });
    }

    // Hit flash overlay
    if (hitFlash > 0.05) {
      this.auraGfx.circle(x, y, r * 1.5);
      this.auraGfx.fill({ color: 0xffffff, alpha: hitFlash * 0.12 });
    }

    // ── 2. Shield arcs (spin faster during intensity) ──
    const shieldSpeedMult = 1 + intensity * 3;
    const shieldR = r * 1.15;
    for (let ring = 0; ring < 3; ring++) {
      const dir = ring === 0 ? 1 : -1;
      const baseAngle = shieldAngle * dir * shieldSpeedMult + ring * 0.4;
      const segments = 5 + ring;
      const gap = 0.18;
      const segArc = (Math.PI * 2 / segments) - gap;

      // Third ring only visible during intensity
      if (ring === 2 && intensity < 0.3) continue;
      for (let s = 0; s < segments; s++) {
        const startA = baseAngle + s * (segArc + gap);
        const sr = shieldR + ring * 8;
        const steps = 8;
        this.shieldGfx.moveTo(
          x + Math.cos(startA) * sr, y + Math.sin(startA) * sr
        );
        for (let j = 1; j <= steps; j++) {
          const a = startA + (segArc * j) / steps;
          this.shieldGfx.lineTo(x + Math.cos(a) * sr, y + Math.sin(a) * sr);
        }
        const shieldAlpha = (0.15 - ring * 0.035) + intensity * 0.08;
        this.shieldGfx.stroke({
          color: ring === 2 ? 0xffffff : (ring === 0 ? color : 0xffffff),
          width: ring === 2 ? (0.6 + intensity * 0.8) : (1.4 - ring * 0.3 + intensity * 0.6),
          alpha: ring === 2 ? intensity * 0.15 : shieldAlpha,
        });
      }
    }

    // ── 3. Mandala — ominous, multi-layered, pulsing sigil ──
    const n = Math.max(3, Math.round(voices));
    const outerM = r * 0.95;
    const innerM = r * 0.3;
    const mandalaSpeed = 0.025 + intensity * 0.15;
    const mandalaRot = time * mandalaSpeed;

    // Layer 0: main sigil — thick, filled, always visible
    const mg = this.mandalaGfx;
    const mPulse = 1 + Math.sin(time * 0.05) * 0.04 + fireIntensity * 0.12;

    // Outer spikes — jagged teeth reaching out from the body
    const spikeN = n * 2;
    const spikeOuter = outerM * mPulse * 1.15;
    const spikeInner = outerM * mPulse * 0.75;
    mg.moveTo(
      x + Math.cos(mandalaRot) * spikeOuter,
      y + Math.sin(mandalaRot) * spikeOuter
    );
    for (let i = 1; i <= spikeN * 2; i++) {
      const a = mandalaRot + (Math.PI * i) / spikeN;
      const sr = i % 2 === 0 ? spikeOuter : spikeInner;
      mg.lineTo(x + Math.cos(a) * sr, y + Math.sin(a) * sr);
    }
    mg.closePath();
    mg.stroke({ color, width: 1.2 + intensity * 1.0, alpha: 0.2 + intensity * 0.12 });
    mg.fill({ color, alpha: 0.025 + intensity * 0.02 });

    // Inner star — counter-rotating, sharper, brighter
    const innerRot = -mandalaRot * 1.3;
    const innerOuter = innerM * mPulse * 2.2;
    const innerInner = innerM * mPulse * 0.6;
    mg.moveTo(
      x + Math.cos(innerRot) * innerOuter,
      y + Math.sin(innerRot) * innerOuter
    );
    for (let i = 1; i <= n * 2; i++) {
      const a = innerRot + (Math.PI * i) / n;
      const sr = i % 2 === 0 ? innerOuter : innerInner;
      mg.lineTo(x + Math.cos(a) * sr, y + Math.sin(a) * sr);
    }
    mg.closePath();
    mg.stroke({ color: 0xffffff, width: 0.8 + intensity * 0.5, alpha: 0.15 + intensity * 0.1 });
    mg.fill({ color, alpha: 0.03 + intensity * 0.02 });

    // Connecting radial lines — web-like threads from center to outer tips
    for (let i = 0; i < spikeN; i++) {
      const a = mandalaRot + (Math.PI * 2 * i) / spikeN;
      mg.moveTo(x, y);
      mg.lineTo(x + Math.cos(a) * spikeOuter * 0.9, y + Math.sin(a) * spikeOuter * 0.9);
      mg.stroke({ color, width: 0.5, alpha: 0.06 + intensity * 0.06 });
    }

    // During high intensity: third layer — ghostly expanded copy
    if (intensity > 0.4) {
      const ghostRot = mandalaRot * 0.7 + 0.5;
      const ghostR = outerM * mPulse * 1.4;
      const ghostInner = outerM * mPulse * 0.5;
      mg.moveTo(
        x + Math.cos(ghostRot) * ghostR,
        y + Math.sin(ghostRot) * ghostR
      );
      for (let i = 1; i <= n * 2; i++) {
        const a = ghostRot + (Math.PI * i) / n;
        const sr = i % 2 === 0 ? ghostR : ghostInner;
        mg.lineTo(x + Math.cos(a) * sr, y + Math.sin(a) * sr);
      }
      mg.closePath();
      mg.stroke({
        color, width: 0.6 + (intensity - 0.4) * 1.5,
        alpha: (intensity - 0.4) * 0.2,
      });
    }

    // ── 4. Core — the EYE ──
    const coreR = r * 0.32;
    const corePulse = 1 + Math.sin(time * 0.06) * 0.08
      + fireIntensity * 0.3 + hitFlash * 0.2;

    this.coreGfx.circle(x, y, coreR * corePulse * 1.1);
    this.coreGfx.fill({ color, alpha: 0.15 + fireIntensity * 0.08 + hitFlash * 0.1 });
    this.coreGfx.circle(x, y, coreR * corePulse * 1.1);
    this.coreGfx.stroke({ color: 0xffffff, width: 1.4, alpha: 0.2 + fireIntensity * 0.1 });

    this.coreGfx.circle(x, y, coreR * corePulse);
    this.coreGfx.fill({ color: 0x111122, alpha: 0.3 });

    const { eyeX, eyeY } = this;
    const irisR = coreR * 0.65;
    this.coreGfx.circle(eyeX, eyeY, irisR);
    this.coreGfx.fill({ color, alpha: 0.22 + hitFlash * 0.15 });
    this.coreGfx.circle(eyeX, eyeY, irisR);
    this.coreGfx.stroke({ color, width: 2, alpha: 0.35 });

    // Iris texture — radial lines
    const irisRot = -time * 0.008;
    for (let i = 0; i < 8; i++) {
      const a = irisRot + (Math.PI * 2 * i) / 8;
      this.coreGfx.moveTo(
        eyeX + Math.cos(a) * irisR * 0.3,
        eyeY + Math.sin(a) * irisR * 0.3
      );
      this.coreGfx.lineTo(
        eyeX + Math.cos(a) * irisR * 0.95,
        eyeY + Math.sin(a) * irisR * 0.95
      );
      this.coreGfx.stroke({ color, width: 0.8, alpha: 0.12 + fireIntensity * 0.05 });
    }

    const pupilR = coreR * 0.38;
    this.coreGfx.circle(eyeX, eyeY, pupilR);
    this.coreGfx.fill({ color: 0xffffff, alpha: 0.55 + fireIntensity * 0.3 + hitFlash * 0.3 });
    this.coreGfx.circle(eyeX, eyeY, pupilR * 0.4);
    this.coreGfx.fill({ color: 0x000000, alpha: 0.55 });

    // Inner glow ring during firing
    if (fireIntensity > 0.4) {
      this.coreGfx.circle(eyeX, eyeY, pupilR * 0.7);
      this.coreGfx.stroke({ color: 0xffffff, width: 0.6, alpha: (fireIntensity - 0.4) * 0.5 });
    }

    // Primary specular highlight
    const specX = eyeX - coreR * 0.1;
    const specY = eyeY - coreR * 0.12;
    this.coreGfx.circle(specX, specY, coreR * 0.09);
    this.coreGfx.fill({ color: 0xffffff, alpha: 0.8 });
    // Secondary specular
    this.coreGfx.circle(eyeX + coreR * 0.06, eyeY + coreR * 0.08, coreR * 0.04);
    this.coreGfx.fill({ color: 0xffffff, alpha: 0.5 });

    // Aim line
    const aimLen = r * 0.5;
    this.coreGfx.moveTo(eyeX, eyeY);
    this.coreGfx.lineTo(
      eyeX + Math.cos(this.aimAngle) * aimLen,
      eyeY + Math.sin(this.aimAngle) * aimLen
    );
    this.coreGfx.stroke({ color: 0xffffff, width: 0.6, alpha: 0.06 + fireIntensity * 0.08 });

    if (fireIntensity > 0.05) {
      this.coreGfx.circle(eyeX, eyeY, pupilR * (1.5 + fireIntensity * 2));
      this.coreGfx.stroke({ color: 0xffffff, width: 1.5, alpha: fireIntensity * 0.3 });
    }

    // ── 5. Emit flashes ──
    for (const f of this.emitFlashes) {
      const t = f.life / f.maxLife;
      const vel = f.velocity;
      const ringR = 5 + (1 - t) * (18 + vel * 14);
      this.emitGfx.circle(f.x, f.y, ringR);
      this.emitGfx.stroke({ color: f.color, width: 1.5, alpha: t * 0.35 });
      const flashR = 2.5 + t * (6 + vel * 5);
      this.emitGfx.circle(f.x, f.y, flashR);
      this.emitGfx.fill({ color: f.color, alpha: t * 0.5 });
      this.emitGfx.circle(f.x, f.y, flashR * 0.35);
      this.emitGfx.fill({ color: 0xffffff, alpha: t * 0.7 });
    }
  }

  reset() {
    this.emitFlashes.length = 0;
    this.time = 0;
    this.shieldAngle = 0;
    this.fireIntensity = 0;
    this.intensity = 0;
    this.hitFlash = 0;
    this.aimAngle = Math.PI / 2;
    this.pupilDist = 0;
    this.swayX = this.swayY = this.swayVx = this.swayVy = 0;
    this.dodgeX = this.dodgeY = 0;
    this.script = null;
  }
}
