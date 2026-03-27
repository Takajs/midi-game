export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(val, min, max) {
  return val < min ? min : val > max ? max : val;
}

export function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleToward(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

export function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

export function randomInt(min, max) {
  return Math.floor(randomRange(min, max + 1));
}

// Seeded random for deterministic patterns from note data
export function seededRandom(seed) {
  let s = seed | 0;
  return function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}
