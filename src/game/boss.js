import { Graphics, Container } from 'pixi.js';
import { gameBounds } from '../utils/constants.js';
import { noteColor } from '../utils/noteColor.js';
import { lerp, clamp } from '../utils/math.js';

/**
 * Boss entity — a living cosmic eye that fires from its pupil.
 *
 * The pupil tracks the player with smooth, organic movement.
 * ALL bullets originate from the pupil position, aimed at the player.
 * Patterns add spread/offset relative to the aim direction.
 *
 * Movement is pre-computed from song analysis but enhanced at runtime
 * with micro-oscillations and player-reactive sway for liveliness.
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

    // Player tracking — smooth aim
    this.playerX = gameBounds.width * 0.5;
    this.playerY = gameBounds.height * 0.8;
    this.aimAngle = Math.PI / 2;       // smoothed angle eye→player
    this.pupilDist = 0;                 // current pupil displacement

    // The eye position (= bullet origin) — computed each frame
    this.eyeX = this.x;
    this.eyeY = this.y;

    // Animation
    this.time = 0;
    this.shieldAngle = 0;

    // Beat pulse
    this.fireIntensity = 0;

    // Micro-sway (runtime liveliness on top of pre-computed path)
    this.swayX = 0;
    this.swayY = 0;
    this.swayVx = 0;
    this.swayVy = 0;

    // Emit flashes at eye
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

  /**
   * Get the bullet origin = eye (pupil) position, aimed directly at player.
   */
  getEmitPoint() {
    return {
      x: this.eyeX,
      y: this.eyeY,
      angle: this.aimAngle,
    };
  }

  /**
   * Flash at the eye when a note fires.
   */
  flashEmit(midiNote, velocity) {
    const color = noteColor(midiNote);
    if (this.emitFlashes.length >= this.maxFlashes) {
      this.emitFlashes.shift();
    }
    this.emitFlashes.push({
      x: this.eyeX, y: this.eyeY, color,
      life: 12, maxLife: 12,
      velocity: velocity || 0.5,
    });
    this.fireIntensity = Math.min(this.fireIntensity + 0.25 + (velocity || 0.5) * 0.45, 1.0);
  }

  update(dt, currentTime, playerX, playerY) {
    this.time += dt;
    this.shieldAngle += 0.012 * dt;
    this.playerX = playerX;
    this.playerY = playerY;

    // ── Interpolate base position from pre-computed script ──
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
    }

    // ── Micro-sway: spring-based oscillation for liveliness ──
    // Random impulse every ~30 frames + beat-driven kick
    if (Math.random() < 0.03 * dt) {
      this.swayVx += (Math.random() - 0.5) * 0.6;
      this.swayVy += (Math.random() - 0.5) * 0.4;
    }
    if (this.fireIntensity > 0.3) {
      // Beat kick: sway away from player slightly
      const kickAngle = this.aimAngle + Math.PI;
      this.swayVx += Math.cos(kickAngle) * this.fireIntensity * 0.15;
      this.swayVy += Math.sin(kickAngle) * this.fireIntensity * 0.1;
    }
    // Spring return + damping
    this.swayVx += -this.swayX * 0.02 * dt;
    this.swayVy += -this.swayY * 0.02 * dt;
    this.swayVx *= Math.pow(0.94, dt);
    this.swayVy *= Math.pow(0.94, dt);
    this.swayX += this.swayVx * dt;
    this.swayY += this.swayVy * dt;
    // Clamp sway
    this.swayX = clamp(this.swayX, -25, 25);
    this.swayY = clamp(this.swayY, -15, 15);

    // ── Player-reactive lean: boss leans slightly toward player ──
    const dx = playerX - baseX;
    const dy = playerY - baseY;
    const distToPlayer = Math.sqrt(dx * dx + dy * dy) || 1;
    const leanFactor = Math.min(0.08, 30 / distToPlayer);
    const leanX = dx * leanFactor;
    const leanY = dy * leanFactor;

    this.x = baseX + this.swayX + leanX;
    this.y = baseY + this.swayY + leanY;

    // ── Clamp boss to game bounds ──
    const margin = this.radius * 0.3;
    this.x = clamp(this.x, margin, gameBounds.width - margin);
    this.y = clamp(this.y, margin, gameBounds.height - margin);

    // ── Smooth aim toward player ──
    const targetAngle = Math.atan2(playerY - this.y, playerX - this.x);
    let angleDiff = targetAngle - this.aimAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.aimAngle += angleDiff * 0.18 * dt; // fast but smooth tracking

    // ── Compute pupil/eye position ──
    const coreR = this.radius * 0.32;
    const maxPupilDist = coreR * 0.65;
    const targetPupilDist = maxPupilDist * (1 - 12 / (distToPlayer + 12));
    this.pupilDist = lerp(this.pupilDist, targetPupilDist, 0.15 * dt);
    this.eyeX = this.x + Math.cos(this.aimAngle) * this.pupilDist;
    this.eyeY = this.y + Math.sin(this.aimAngle) * this.pupilDist;

    // ── Decay beat pulse ──
    this.fireIntensity *= Math.pow(0.86, dt);
    if (this.fireIntensity < 0.01) this.fireIntensity = 0;

    // ── Decay emit flashes ──
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

    const { x, y, radius: r, color, voices, time, shieldAngle, fireIntensity } = this;

    // ── 1. Aura: 4 concentric glow circles (beat-reactive) ──
    for (let i = 3; i >= 0; i--) {
      const aR = r * (1.6 + i * 0.35);
      const beatPulse = 1 + fireIntensity * 0.18;
      const pulse = beatPulse + Math.sin(time * 0.04 + i * 1.2) * 0.06;
      this.auraGfx.circle(x, y, aR * pulse);
      this.auraGfx.fill({ color, alpha: (0.015 - i * 0.002) + fireIntensity * 0.008 });
    }

    // ── 2. Shield arcs: 2 counter-rotating broken ring sets ──
    const shieldR = r * 1.15;
    for (let ring = 0; ring < 2; ring++) {
      const dir = ring === 0 ? 1 : -1;
      const baseAngle = shieldAngle * dir + ring * 0.4;
      const segments = 5 + ring;
      const gap = 0.18;
      const segArc = (Math.PI * 2 / segments) - gap;

      for (let s = 0; s < segments; s++) {
        const startA = baseAngle + s * (segArc + gap);
        const sr = shieldR + ring * 6;
        const steps = 8;
        this.shieldGfx.moveTo(
          x + Math.cos(startA) * sr,
          y + Math.sin(startA) * sr
        );
        for (let j = 1; j <= steps; j++) {
          const a = startA + (segArc * j) / steps;
          this.shieldGfx.lineTo(x + Math.cos(a) * sr, y + Math.sin(a) * sr);
        }
        this.shieldGfx.stroke({
          color: ring === 0 ? color : 0xffffff,
          width: 1.2 - ring * 0.4,
          alpha: 0.15 - ring * 0.04,
        });
      }
    }

    // ── 3. Mandala: n-pointed star ──
    const n = Math.max(3, Math.round(voices));
    const outerM = r * 0.85;
    const innerM = r * 0.35;
    this.mandalaGfx.moveTo(
      x + Math.cos(time * 0.02) * outerM,
      y + Math.sin(time * 0.02) * outerM
    );
    for (let i = 1; i <= n * 2; i++) {
      const a = time * 0.02 + (Math.PI * i) / n;
      const mr = i % 2 === 0 ? outerM : innerM;
      this.mandalaGfx.lineTo(x + Math.cos(a) * mr, y + Math.sin(a) * mr);
    }
    this.mandalaGfx.closePath();
    this.mandalaGfx.stroke({ color, width: 0.8, alpha: 0.12 });
    this.mandalaGfx.fill({ color, alpha: 0.02 });

    // ── 4. Core: the EYE — pupil is the cannon ──
    const coreR = r * 0.32;
    const corePulse = 1 + Math.sin(time * 0.06) * 0.08 + fireIntensity * 0.3;

    // Eye socket (outer ring)
    this.coreGfx.circle(x, y, coreR * corePulse * 1.1);
    this.coreGfx.fill({ color, alpha: 0.15 + fireIntensity * 0.08 });
    this.coreGfx.circle(x, y, coreR * corePulse * 1.1);
    this.coreGfx.stroke({ color: 0xffffff, width: 1.4, alpha: 0.2 + fireIntensity * 0.1 });

    // Eye white
    this.coreGfx.circle(x, y, coreR * corePulse);
    this.coreGfx.fill({ color: 0x111122, alpha: 0.3 });

    // Iris (colored, follows pupil)
    const { eyeX, eyeY } = this;
    const irisR = coreR * 0.6;
    this.coreGfx.circle(eyeX, eyeY, irisR);
    this.coreGfx.fill({ color, alpha: 0.2 });
    this.coreGfx.circle(eyeX, eyeY, irisR);
    this.coreGfx.stroke({ color, width: 1.8, alpha: 0.3 });

    // Pupil (bright center — the barrel)
    const pupilR = coreR * 0.35;
    this.coreGfx.circle(eyeX, eyeY, pupilR);
    this.coreGfx.fill({ color: 0xffffff, alpha: 0.5 + fireIntensity * 0.3 });
    this.coreGfx.circle(eyeX, eyeY, pupilR * 0.4);
    this.coreGfx.fill({ color: 0x000000, alpha: 0.55 });

    // Specular highlight
    const specX = eyeX - coreR * 0.1;
    const specY = eyeY - coreR * 0.12;
    this.coreGfx.circle(specX, specY, coreR * 0.08);
    this.coreGfx.fill({ color: 0xffffff, alpha: 0.75 });

    // Aim line: faint line from pupil toward player
    const aimLen = r * 0.5;
    this.coreGfx.moveTo(eyeX, eyeY);
    this.coreGfx.lineTo(
      eyeX + Math.cos(this.aimAngle) * aimLen,
      eyeY + Math.sin(this.aimAngle) * aimLen
    );
    this.coreGfx.stroke({ color: 0xffffff, width: 0.6, alpha: 0.06 + fireIntensity * 0.08 });

    // Beat flash on core
    if (fireIntensity > 0.05) {
      this.coreGfx.circle(eyeX, eyeY, pupilR * (1.5 + fireIntensity * 2));
      this.coreGfx.stroke({ color: 0xffffff, width: 1.5, alpha: fireIntensity * 0.3 });
    }

    // ── 5. Emit flashes at eye ──
    for (const f of this.emitFlashes) {
      const t = f.life / f.maxLife;
      const vel = f.velocity;

      // Expanding ring from eye
      const ringR = 3 + (1 - t) * (12 + vel * 10);
      this.emitGfx.circle(f.x, f.y, ringR);
      this.emitGfx.stroke({ color: f.color, width: 1, alpha: t * 0.3 });

      // Core flash
      const flashR = 1.5 + t * (4 + vel * 3);
      this.emitGfx.circle(f.x, f.y, flashR);
      this.emitGfx.fill({ color: f.color, alpha: t * 0.45 });

      // White-hot center
      this.emitGfx.circle(f.x, f.y, flashR * 0.35);
      this.emitGfx.fill({ color: 0xffffff, alpha: t * 0.65 });
    }
  }

  reset() {
    this.emitFlashes.length = 0;
    this.time = 0;
    this.shieldAngle = 0;
    this.fireIntensity = 0;
    this.aimAngle = Math.PI / 2;
    this.pupilDist = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.swayVx = 0;
    this.swayVy = 0;
    this.script = null;
  }
}
