import { Graphics, Container } from 'pixi.js';
import { gameBounds } from '../utils/constants.js';

/**
 * Deep-space background with parallax star layers, horizontal fog bands,
 * a soft ambient center glow, and real-time audio-reactive brightness.
 *
 * Fog bands span the full screen width and use a gaussian alpha falloff
 * so they read as atmospheric haze — never confused with gameplay elements.
 */
export class Background {
  constructor() {
    this.container = new Container();
    this.container.zIndex = 0;

    this.bg = new Graphics();
    this.container.addChild(this.bg);

    // Fog + ambient glow layer (redrawn on resize / theme change)
    this.fogGfx = new Graphics();
    this.container.addChild(this.fogGfx);

    // Star layers
    this.starLayers = [];
    this._initStars();

    this.starGraphics = [];
    for (let layer = 0; layer < this.starLayers.length; layer++) {
      const g = new Graphics();
      this.container.addChild(g);
      this.starGraphics.push(g);
    }

    // Vignette
    this.vignette = new Graphics();
    this.container.addChild(this.vignette);

    this.time = 0;
    this._lastW = 0;
    this._lastH = 0;
    this._bgColor = 0x05050e;
    this._vignetteColor = 0x000000;
    this._fog = null;
    this._ambientGlow = null;
    this._fogOffset = 0;

    // Audio reactivity
    this._intensity = 0;
    this._targetIntensity = 0;

    this._drawStatic();
  }

  setTheme(colors) {
    if (colors) {
      this._bgColor = colors.bg || 0x05050e;
      this._vignetteColor = colors.vignette || 0x000000;
      this._fog = colors.fog || null;
      this._ambientGlow = colors.ambientGlow || null;
      if (colors.stars && colors.stars.length === 3) {
        for (let l = 0; l < this.starLayers.length; l++) {
          this.starLayers[l].color = colors.stars[l];
        }
      }
    } else {
      this._bgColor = 0x05050e;
      this._vignetteColor = 0x000000;
      this._fog = null;
      this._ambientGlow = null;
      const defaults = [0x6666aa, 0x8888cc, 0xaaaaee];
      for (let l = 0; l < this.starLayers.length; l++) {
        this.starLayers[l].color = defaults[l];
      }
    }
    this._drawStatic();
  }

  setIntensity(density) {
    this._targetIntensity = density;
  }

  _initStars() {
    const w = gameBounds.width;
    const h = gameBounds.height;
    const areaScale = (w * h) / (1920 * 1080);

    const layers = [
      { count: Math.round(120 * areaScale), speed: 0.08, sizeMin: 0.4, sizeMax: 1.0, alphaMin: 0.08, alphaMax: 0.2, color: 0x6666aa },
      { count: Math.round(60 * areaScale), speed: 0.18, sizeMin: 0.6, sizeMax: 1.4, alphaMin: 0.1, alphaMax: 0.3, color: 0x8888cc },
      { count: Math.round(25 * areaScale), speed: 0.35, sizeMin: 0.8, sizeMax: 1.8, alphaMin: 0.15, alphaMax: 0.45, color: 0xaaaaee },
    ];

    for (const cfg of layers) {
      const stars = [];
      for (let i = 0; i < cfg.count; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          size: cfg.sizeMin + Math.random() * (cfg.sizeMax - cfg.sizeMin),
          alpha: cfg.alphaMin + Math.random() * (cfg.alphaMax - cfg.alphaMin),
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.003 + Math.random() * 0.006,
        });
      }
      this.starLayers.push({ stars, speed: cfg.speed, color: cfg.color });
    }
  }

  _drawStatic() {
    const w = gameBounds.width;
    const h = gameBounds.height;

    // Background fill
    this.bg.clear();
    this.bg.rect(0, 0, w, h);
    this.bg.fill({ color: this._bgColor });

    // Fog bands — horizontal strips with gaussian alpha falloff
    this.fogGfx.clear();
    if (this._fog) {
      for (const f of this._fog) {
        const cy = f.y * h;
        const sigma = f.spread * h;
        const bandH = Math.ceil(sigma * 3);
        const top = Math.max(0, Math.floor(cy - bandH));
        const bot = Math.min(h, Math.ceil(cy + bandH));
        // Draw in strips of 4px for performance
        const step = 4;
        for (let y = top; y < bot; y += step) {
          const dist = (y - cy) / sigma;
          const a = f.alpha * Math.exp(-0.5 * dist * dist);
          if (a < 0.002) continue;
          this.fogGfx.rect(0, y, w, step);
          this.fogGfx.fill({ color: f.color, alpha: a });
        }
      }
    }

    // Ambient center glow — a very large, very subtle oval
    if (this._ambientGlow) {
      const g = this._ambientGlow;
      const cx = w * 0.5;
      const cy = h * 0.45;
      const rings = 8;
      const maxR = Math.max(w, h) * 0.45;
      for (let i = rings; i >= 0; i--) {
        const t = i / rings;
        const r = maxR * (0.3 + t * 0.7);
        const a = g.alpha * (1 - t) * (1 - t);
        if (a < 0.001) continue;
        this.fogGfx.ellipse(cx, cy, r, r * 0.7);
        this.fogGfx.fill({ color: g.color, alpha: a });
      }
    }

    // Vignette — darkened edges and corners
    const vc = this._vignetteColor;
    this.vignette.clear();
    const topDepth = Math.round(h * 0.12);
    for (let i = 0; i < topDepth; i += 2) {
      const alpha = 0.45 * Math.pow(1 - i / topDepth, 2);
      this.vignette.rect(0, i, w, 2);
      this.vignette.fill({ color: vc, alpha });
    }
    const botDepth = Math.round(h * 0.12);
    for (let i = 0; i < botDepth; i += 2) {
      const alpha = 0.4 * Math.pow(1 - i / botDepth, 2);
      this.vignette.rect(0, h - i, w, 2);
      this.vignette.fill({ color: vc, alpha });
    }
    const sideDepth = Math.round(w * 0.06);
    for (let i = 0; i < sideDepth; i += 2) {
      const alpha = 0.25 * Math.pow(1 - i / sideDepth, 2);
      this.vignette.rect(i, 0, 2, h);
      this.vignette.fill({ color: vc, alpha });
      this.vignette.rect(w - i, 0, 2, h);
      this.vignette.fill({ color: vc, alpha });
    }

    this._lastW = w;
    this._lastH = h;
  }

  update(dt) {
    this.time += dt;

    // Smooth intensity tracking
    this._intensity += (this._targetIntensity - this._intensity) * 0.06 * dt;

    const w = gameBounds.width;
    const h = gameBounds.height;

    if (w !== this._lastW || h !== this._lastH) {
      this._drawStatic();
    }

    // Intensity boost: foreground stars get brighter during dense passages
    const intensityBoost = 1 + this._intensity * 0.5;

    for (let l = 0; l < this.starLayers.length; l++) {
      const layer = this.starLayers[l];
      const g = this.starGraphics[l];
      g.clear();

      // Front layer gets the most intensity boost
      const layerBoost = l === 2 ? intensityBoost : (l === 1 ? 1 + this._intensity * 0.25 : 1);

      for (const star of layer.stars) {
        star.y += layer.speed * dt;
        if (star.y > h + 5) {
          star.y = -5;
          star.x = Math.random() * w;
        }

        star.twinklePhase += star.twinkleSpeed * dt;
        const twinkle = 0.7 + 0.3 * Math.sin(star.twinklePhase);
        const alpha = Math.min(1, star.alpha * twinkle * layerBoost);
        const size = l === 2 ? star.size * (1 + this._intensity * 0.15) : star.size;

        g.circle(star.x, star.y, size);
        g.fill({ color: layer.color, alpha });
      }
    }
  }
}
