import { Graphics, Container } from 'pixi.js';
import { gameBounds } from '../utils/constants.js';

/**
 * Serene, stable fullscreen background — deep space with parallax star layers
 * and a per-level nebula fog that gives each planet its visual identity.
 */
export class Background {
  constructor() {
    this.container = new Container();
    this.container.zIndex = 0;

    // Deep dark base (redrawn on resize)
    this.bg = new Graphics();
    this.container.addChild(this.bg);

    // Nebula layer — large soft colored fog, drawn once per theme
    this.nebulaGfx = new Graphics();
    this.container.addChild(this.nebulaGfx);

    // Star layers
    this.starLayers = [];
    this._initStars();

    this.starGraphics = [];
    for (let layer = 0; layer < this.starLayers.length; layer++) {
      const g = new Graphics();
      this.container.addChild(g);
      this.starGraphics.push(g);
    }

    // Vignette (redrawn on resize)
    this.vignette = new Graphics();
    this.container.addChild(this.vignette);

    this.time = 0;
    this._lastW = 0;
    this._lastH = 0;
    this._bgColor = 0x05050e;
    this._vignetteColor = 0x000000;
    this._nebulae = null; // array of { x, y, radius, color, alpha }
    this._drawStatic();
  }

  setTheme(colors) {
    if (colors) {
      this._bgColor = colors.bg || 0x05050e;
      this._vignetteColor = colors.vignette || 0x000000;
      this._nebulae = colors.nebulae || null;
      if (colors.stars && colors.stars.length === 3) {
        for (let l = 0; l < this.starLayers.length; l++) {
          this.starLayers[l].color = colors.stars[l];
        }
      }
    } else {
      this._bgColor = 0x05050e;
      this._vignetteColor = 0x000000;
      this._nebulae = null;
      const defaults = [0x6666aa, 0x8888cc, 0xaaaaee];
      for (let l = 0; l < this.starLayers.length; l++) {
        this.starLayers[l].color = defaults[l];
      }
    }
    this._drawStatic();
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

    // Nebula fog — concentric circles fading out, positioned per theme
    this.nebulaGfx.clear();
    if (this._nebulae) {
      for (const n of this._nebulae) {
        const cx = n.x * w;
        const cy = n.y * h;
        const maxR = n.radius * Math.max(w, h);
        const rings = 10;
        for (let i = rings; i >= 0; i--) {
          const t = i / rings;
          const r = maxR * t;
          const a = n.alpha * (1 - t) * (1 - t);
          this.nebulaGfx.circle(cx, cy, r);
          this.nebulaGfx.fill({ color: n.color, alpha: a });
        }
      }
    }

    // Vignette
    const vc = this._vignetteColor;
    this.vignette.clear();
    const topDepth = Math.round(h * 0.1);
    for (let i = 0; i < topDepth; i++) {
      const alpha = 0.4 * Math.pow(1 - i / topDepth, 2);
      this.vignette.rect(0, i, w, 1);
      this.vignette.fill({ color: vc, alpha });
    }
    const botDepth = Math.round(h * 0.08);
    for (let i = 0; i < botDepth; i++) {
      const alpha = 0.35 * Math.pow(1 - i / botDepth, 2);
      this.vignette.rect(0, h - i, w, 1);
      this.vignette.fill({ color: vc, alpha });
    }
    const sideDepth = Math.round(w * 0.03);
    for (let i = 0; i < sideDepth; i++) {
      const alpha = 0.2 * Math.pow(1 - i / sideDepth, 2);
      this.vignette.rect(i, 0, 1, h);
      this.vignette.fill({ color: vc, alpha });
      this.vignette.rect(w - i, 0, 1, h);
      this.vignette.fill({ color: vc, alpha });
    }

    this._lastW = w;
    this._lastH = h;
  }

  update(dt) {
    this.time += dt;

    const w = gameBounds.width;
    const h = gameBounds.height;

    if (w !== this._lastW || h !== this._lastH) {
      this._drawStatic();
    }

    for (let l = 0; l < this.starLayers.length; l++) {
      const layer = this.starLayers[l];
      const g = this.starGraphics[l];
      g.clear();

      for (const star of layer.stars) {
        star.y += layer.speed * dt;
        if (star.y > h + 5) {
          star.y = -5;
          star.x = Math.random() * w;
        }

        star.twinklePhase += star.twinkleSpeed * dt;
        const twinkle = 0.7 + 0.3 * Math.sin(star.twinklePhase);
        const alpha = star.alpha * twinkle;

        g.circle(star.x, star.y, star.size);
        g.fill({ color: layer.color, alpha });
      }
    }
  }
}
