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
};

// Track visual styles (cycle for tracks > 4)
// 0 = filled orb, 1 = hollow ring, 2 = rimmed orb, 3 = compact dense
export const TRACK_STYLES = 4;
