/**
 * Built-in level definitions — one per celestial body.
 *
 * Each theme controls:
 *  - Visual atmosphere: bg color, fog bands, ambient glow, star tint, boss color
 *  - Gameplay feel: bullet speed/size multipliers
 *
 * fog:  Horizontal color wash bands with gaussian falloff.
 *       { y: 0-1 vertical center, spread: sigma fraction, color, alpha }
 * ambientGlow: Soft central oval that sets the scene's color temperature.
 */

export const LEVELS = [
  {
    id: 'Mercurio',
    file: 'Mercurio.mid',
    name: 'Mercurio',
    subtitle: 'Scorched Messenger',
    difficulty: 2,
    css: {
      gradient: 'radial-gradient(circle at 35% 35%, #b8a090 0%, #7a6050 50%, #3a2820 100%)',
      glow: 'rgba(180, 140, 100, 0.5)',
    },
    colors: {
      bg: 0x08040a,
      stars: [0xcc9966, 0xddaa77, 0xffcc88],
      vignette: 0x1a0800,
      fog: [
        { y: 0.8, spread: 0.2, color: 0xff6600, alpha: 0.035 },
        { y: 0.3, spread: 0.35, color: 0xcc4400, alpha: 0.02 },
      ],
      ambientGlow: { color: 0xff8844, alpha: 0.02 },
    },
    bossColor: 0xdd8844,
    gameplay: { speedMult: 1.25, sizeMult: 0.75 },
  },
  {
    id: 'Venus',
    file: 'Venus.mid',
    name: 'Venus',
    subtitle: 'Veiled Inferno',
    difficulty: 3,
    css: {
      gradient: 'radial-gradient(circle at 40% 30%, #e8c86a 0%, #c49a3a 45%, #6a4a18 100%)',
      glow: 'rgba(220, 180, 80, 0.5)',
    },
    colors: {
      bg: 0x0a0804,
      stars: [0xccaa55, 0xddbb66, 0xeecc88],
      vignette: 0x140e04,
      fog: [
        { y: 0.45, spread: 0.4, color: 0xddaa33, alpha: 0.04 },
        { y: 0.8, spread: 0.2, color: 0xcc8800, alpha: 0.03 },
      ],
      ambientGlow: { color: 0xccaa44, alpha: 0.025 },
    },
    bossColor: 0xddaa44,
    gameplay: { speedMult: 0.85, sizeMult: 1.3 },
  },
  {
    id: 'Tierra',
    file: 'Tierra.mid',
    name: 'Tierra',
    subtitle: 'Pale Blue Dot',
    difficulty: 2,
    css: {
      gradient: 'radial-gradient(circle at 40% 35%, #6ab4e8 0%, #3a8a3a 40%, #2a4a6a 100%)',
      glow: 'rgba(80, 160, 220, 0.5)',
    },
    colors: {
      bg: 0x040810,
      stars: [0x6688cc, 0x88aadd, 0xaaccff],
      vignette: 0x061020,
      fog: [
        { y: 0.3, spread: 0.3, color: 0x2266bb, alpha: 0.035 },
        { y: 0.75, spread: 0.25, color: 0x22aa66, alpha: 0.025 },
      ],
      ambientGlow: { color: 0x4488cc, alpha: 0.02 },
    },
    bossColor: 0x4488cc,
    gameplay: { speedMult: 1.0, sizeMult: 1.0 },
  },
  {
    id: 'Luna',
    file: 'Luna.mid',
    name: 'Luna',
    subtitle: 'Silent Guardian',
    difficulty: 1,
    css: {
      gradient: 'radial-gradient(circle at 38% 32%, #e0dcd8 0%, #a8a4a0 50%, #58544e 100%)',
      glow: 'rgba(200, 200, 215, 0.5)',
    },
    colors: {
      bg: 0x06060c,
      stars: [0x9999cc, 0xbbbbdd, 0xddddff],
      vignette: 0x0a0a18,
      fog: [
        { y: 0.5, spread: 0.45, color: 0x8888bb, alpha: 0.025 },
      ],
      ambientGlow: { color: 0xaaaacc, alpha: 0.015 },
    },
    bossColor: 0x9999cc,
    gameplay: { speedMult: 0.7, sizeMult: 0.85 },
  },
  {
    id: 'Marte',
    file: 'Marte.mid',
    name: 'Marte',
    subtitle: 'Crimson Wrath',
    difficulty: 3,
    css: {
      gradient: 'radial-gradient(circle at 35% 35%, #d47050 0%, #9a3a28 50%, #4a1a10 100%)',
      glow: 'rgba(200, 80, 50, 0.5)',
    },
    colors: {
      bg: 0x0a0404,
      stars: [0xcc6644, 0xdd7755, 0xff9977],
      vignette: 0x200808,
      fog: [
        { y: 0.25, spread: 0.3, color: 0xcc2200, alpha: 0.04 },
        { y: 0.7, spread: 0.25, color: 0x881100, alpha: 0.03 },
      ],
      ambientGlow: { color: 0xcc3322, alpha: 0.025 },
    },
    bossColor: 0xcc4422,
    gameplay: { speedMult: 1.3, sizeMult: 1.1 },
  },
  {
    id: 'Jupiter',
    file: 'Jupiter.mid',
    name: 'Jupiter',
    subtitle: 'King of Storms',
    difficulty: 4,
    css: {
      gradient: 'radial-gradient(circle at 40% 35%, #d4a060 0%, #b07830 40%, #6a4420 100%)',
      glow: 'rgba(200, 150, 70, 0.5)',
    },
    colors: {
      bg: 0x080604,
      stars: [0xbb8844, 0xccaa55, 0xddbb77],
      vignette: 0x140c04,
      fog: [
        { y: 0.3, spread: 0.3, color: 0xcc7722, alpha: 0.04 },
        { y: 0.55, spread: 0.2, color: 0x884411, alpha: 0.035 },
        { y: 0.8, spread: 0.2, color: 0xdd9933, alpha: 0.025 },
      ],
      ambientGlow: { color: 0xcc8833, alpha: 0.03 },
    },
    bossColor: 0xcc8833,
    gameplay: { speedMult: 0.9, sizeMult: 1.5 },
  },
  {
    id: 'Saturno',
    file: 'Saturno.mid',
    name: 'Saturno',
    subtitle: 'Lord of the Rings',
    difficulty: 3,
    css: {
      gradient: 'radial-gradient(circle at 38% 35%, #e8d498 0%, #c4a458 45%, #7a6430 100%)',
      glow: 'rgba(210, 190, 120, 0.5)',
      ring: true,
    },
    colors: {
      bg: 0x080804,
      stars: [0xaa9955, 0xccbb77, 0xddcc99],
      vignette: 0x121008,
      fog: [
        { y: 0.4, spread: 0.35, color: 0xbbaa44, alpha: 0.035 },
        { y: 0.75, spread: 0.2, color: 0x998833, alpha: 0.025 },
      ],
      ambientGlow: { color: 0xccaa55, alpha: 0.02 },
    },
    bossColor: 0xccaa44,
    gameplay: { speedMult: 1.05, sizeMult: 1.15 },
  },
  {
    id: 'Urano',
    file: 'Urano.mid',
    name: 'Urano',
    subtitle: 'Frozen Enigma',
    difficulty: 4,
    css: {
      gradient: 'radial-gradient(circle at 42% 38%, #88dde8 0%, #50a0b8 50%, #1a4a5a 100%)',
      glow: 'rgba(100, 200, 220, 0.5)',
    },
    colors: {
      bg: 0x040810,
      stars: [0x44aacc, 0x66ccdd, 0x88eeff],
      vignette: 0x061418,
      fog: [
        { y: 0.5, spread: 0.35, color: 0x0088bb, alpha: 0.045 },
        { y: 0.2, spread: 0.2, color: 0x00aacc, alpha: 0.025 },
      ],
      ambientGlow: { color: 0x44bbdd, alpha: 0.025 },
    },
    bossColor: 0x44aacc,
    gameplay: { speedMult: 1.2, sizeMult: 0.9 },
  },
];
