// Dynamic game bounds — updated on resize to match the actual screen
export const gameBounds = {
  width: window.innerWidth,
  height: window.innerHeight,
};

// Player
export const PLAYER_RADIUS = 8;
export const PLAYER_HITBOX_RADIUS = 3; // Tiny hitbox like Touhou
export const PLAYER_SPEED = 5;
export const PLAYER_FOCUS_SPEED = 2.2;
export const PLAYER_START_LIVES = 3;
export const PLAYER_INVULN_TIME = 2000; // ms of invulnerability after hit

// Bullets
export const BULLET_POOL_SIZE = 3000;
export const MAX_ACTIVE_BULLETS = 2500;

// Note-to-color mapping (by pitch class 0-11)
export const NOTE_COLORS = [
  0xff6b9d, // C  - pink
  0xc44dff, // C# - purple
  0x6b8aff, // D  - blue
  0x4dffea, // D# - cyan
  0x4dff91, // E  - green
  0xb8ff4d, // F  - lime
  0xfff44d, // F# - yellow
  0xffb84d, // G  - orange
  0xff6b4d, // G# - red-orange
  0xff4d6b, // A  - red
  0xff4da8, // A# - magenta
  0xe84dff, // B  - violet
];

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
