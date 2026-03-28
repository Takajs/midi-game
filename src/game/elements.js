import { Graphics } from 'pixi.js';
import { ELEMENTS } from '../utils/constants.js';

/**
 * Musical Element System.
 *
 * Maps MIDI register to one of 5 elements, each with a distinct
 * visual personality: texture shape, trail style, glow behavior.
 *
 * EARTH (0-35):     Heavy orb, wide glow, gravitational pull feel
 * WATER (36-59):    Ripple ring, flowing trails, sinuous movement
 * FIRE (60-83):     Bright core, radiant glow, ember particles
 * AIR (84-107):     Crisp small dot, sparkle trail, light & quick
 * LIGHTNING (108+): Star/spike shape, electric arcs, sharp flash
 */

const ELEMENT_DEFS = [
  { name: 'EARTH',     midiMin: 0,   midiMax: 35,  radiusScale: 1.3, trailMul: 1.4,  glowMul: 1.5  },
  { name: 'WATER',     midiMin: 36,  midiMax: 59,  radiusScale: 1.0, trailMul: 1.2,  glowMul: 1.0  },
  { name: 'FIRE',      midiMin: 60,  midiMax: 83,  radiusScale: 1.1, trailMul: 1.0,  glowMul: 1.3  },
  { name: 'AIR',       midiMin: 84,  midiMax: 107, radiusScale: 0.7, trailMul: 0.6,  glowMul: 0.7  },
  { name: 'LIGHTNING', midiMin: 108, midiMax: 127, radiusScale: 0.85, trailMul: 0.4, glowMul: 1.1  },
];

export { ELEMENT_DEFS };

/**
 * Derive element index from a MIDI note number.
 */
export function getElement(midiNote) {
  if (midiNote <= 35) return ELEMENTS.EARTH;
  if (midiNote <= 59) return ELEMENTS.WATER;
  if (midiNote <= 83) return ELEMENTS.FIRE;
  if (midiNote <= 107) return ELEMENTS.AIR;
  return ELEMENTS.LIGHTNING;
}

/**
 * Pre-render 5 white element textures via PixiJS Graphics → RenderTexture.
 * Bullets tint these at render time for zero per-frame geometry cost.
 *
 * Returns Texture[5] indexed by ELEMENTS enum.
 */
export function generateElementTextures(pixiRenderer) {
  const textures = [];
  const baseSize = 32; // texture pixel size (half-extent)
  const g = new Graphics();

  // --- EARTH: large soft orb with heavy glow ---
  g.clear();
  g.circle(baseSize, baseSize, baseSize * 0.9);
  g.fill({ color: 0xffffff, alpha: 0.07 });
  g.circle(baseSize, baseSize, baseSize * 0.6);
  g.fill({ color: 0xffffff, alpha: 0.2 });
  g.circle(baseSize, baseSize, baseSize * 0.4);
  g.fill({ color: 0xffffff, alpha: 0.7 });
  g.circle(baseSize, baseSize, baseSize * 0.15);
  g.fill({ color: 0xffffff, alpha: 0.95 });
  textures.push(pixiRenderer.generateTexture({ target: g, resolution: 1 }));

  // --- WATER: ripple ring ---
  g.clear();
  g.circle(baseSize, baseSize, baseSize * 0.7);
  g.fill({ color: 0xffffff, alpha: 0.05 });
  g.circle(baseSize, baseSize, baseSize * 0.5);
  g.stroke({ color: 0xffffff, width: 2.5, alpha: 0.6 });
  g.circle(baseSize, baseSize, baseSize * 0.25);
  g.fill({ color: 0xffffff, alpha: 0.5 });
  g.circle(baseSize, baseSize, baseSize * 0.1);
  g.fill({ color: 0xffffff, alpha: 0.9 });
  textures.push(pixiRenderer.generateTexture({ target: g, resolution: 1 }));

  // --- FIRE: bright core with radiant outer ---
  g.clear();
  g.circle(baseSize, baseSize, baseSize * 0.8);
  g.fill({ color: 0xffffff, alpha: 0.06 });
  g.circle(baseSize, baseSize, baseSize * 0.45);
  g.fill({ color: 0xffffff, alpha: 0.25 });
  g.circle(baseSize, baseSize, baseSize * 0.3);
  g.fill({ color: 0xffffff, alpha: 0.75 });
  g.circle(baseSize, baseSize, baseSize * 0.12);
  g.fill({ color: 0xffffff, alpha: 1.0 });
  textures.push(pixiRenderer.generateTexture({ target: g, resolution: 1 }));

  // --- AIR: crisp small dot ---
  g.clear();
  g.circle(baseSize, baseSize, baseSize * 0.5);
  g.fill({ color: 0xffffff, alpha: 0.04 });
  g.circle(baseSize, baseSize, baseSize * 0.25);
  g.fill({ color: 0xffffff, alpha: 0.5 });
  g.circle(baseSize, baseSize, baseSize * 0.1);
  g.fill({ color: 0xffffff, alpha: 0.95 });
  textures.push(pixiRenderer.generateTexture({ target: g, resolution: 1 }));

  // --- LIGHTNING: star/spike shape ---
  g.clear();
  g.circle(baseSize, baseSize, baseSize * 0.6);
  g.fill({ color: 0xffffff, alpha: 0.05 });
  // 6-pointed star
  const cx = baseSize, cy = baseSize;
  const outerR = baseSize * 0.5, innerR = baseSize * 0.2;
  const points = 6;
  g.moveTo(cx + outerR, cy);
  for (let i = 1; i <= points * 2; i++) {
    const angle = (Math.PI * i) / points;
    const r = i % 2 === 0 ? outerR : innerR;
    g.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  }
  g.closePath();
  g.fill({ color: 0xffffff, alpha: 0.7 });
  g.circle(baseSize, baseSize, baseSize * 0.12);
  g.fill({ color: 0xffffff, alpha: 1.0 });
  textures.push(pixiRenderer.generateTexture({ target: g, resolution: 1 }));

  g.destroy();
  return textures;
}
