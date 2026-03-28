// Dynamic game bounds — updated on resize to match the actual screen
export const gameBounds = {
  width: window.innerWidth,
  height: window.innerHeight,
};

// Player
export const PLAYER_RADIUS = 8;
export const PLAYER_HITBOX_RADIUS = 3;
export const PLAYER_SPEED = 5;
export const PLAYER_FOCUS_SPEED = 2.2;
export const PLAYER_START_LIVES = 3;
export const PLAYER_INVULN_TIME = 2000;

// Bullets
export const BULLET_POOL_SIZE = 3000;
export const MAX_ACTIVE_BULLETS = 2500;

// Bullet pattern types
export const PATTERNS = {
  SINGLE: 'single',
  SPREAD: 'spread',
  RING: 'ring',
  AIMED: 'aimed',
  STREAM: 'stream',
  SPIRAL: 'spiral',
  WAVE: 'wave',
  RAIN: 'rain',
  CROSSFIRE: 'crossfire',   // side-wall diagonal curtains
  ARC: 'arc',               // curved arcing shots from edges
};

// Musical elements — derived from MIDI register
export const ELEMENTS = {
  EARTH: 0,     // midi 0-35: heavy, gravitational
  WATER: 1,     // midi 36-59: flowing, sinuous
  FIRE: 2,      // midi 60-83: bright, radiant
  AIR: 3,       // midi 84-107: light, sparkly
  LIGHTNING: 4,  // midi 108+: electric, sharp
};
