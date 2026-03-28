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
  SINGLE:    0,
  SPREAD:    1,
  RING:      2,
  AIMED:     3,
  STREAM:    4,
  SPIRAL:    5,
  WAVE:      6,
  RAIN:      7,
  CROSSFIRE: 8,
  ARC:       9,
  HELIX:     10,
  FLOWER:    11,
  CASCADE:   12,
  VORTEX:    13,
};

// Trajectory types
export const TRAJ = {
  STRAIGHT:  0,
  WAVY:      1,
  ACCEL:     2,
  HOMING:    3,
  DECEL:     4,  // slow → pause → burst forward
  SINE_ARC:  5,  // curving arc
  BOOMERANG: 6,  // decelerates, reverses
};
