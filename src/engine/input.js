/**
 * Keyboard input manager.
 * WASD = movement, Arrow keys = shoot direction, Space = bomb.
 * Ignores auto-repeat events to prevent main-thread congestion
 * that starves the Web Audio scheduler (fixes audio lag on key hold).
 */
export class InputManager {
  constructor() {
    this.keys = new Set();

    // Track single-press actions (consumed once per press)
    this._justPressed = new Set();

    this._onKeyDown = (e) => {
      if (e.repeat) return;

      this.keys.add(e.code);
      this._justPressed.add(e.code);

      if (e.code.startsWith('Arrow') || e.code.startsWith('Key') ||
          e.code === 'ShiftLeft' || e.code === 'ShiftRight' ||
          e.code === 'Space') {
        e.preventDefault();
      }
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
    };

    window.addEventListener('keydown', this._onKeyDown, { passive: false });
    window.addEventListener('keyup', this._onKeyUp);
  }

  isPressed(code) {
    return this.keys.has(code);
  }

  /** Returns true once per press (consumed on read). */
  wasJustPressed(code) {
    if (this._justPressed.has(code)) {
      this._justPressed.delete(code);
      return true;
    }
    return false;
  }

  // Movement: WASD
  get left() { return this.isPressed('KeyA'); }
  get right() { return this.isPressed('KeyD'); }
  get up() { return this.isPressed('KeyW'); }
  get down() { return this.isPressed('KeyS'); }
  get focus() { return this.isPressed('ShiftLeft') || this.isPressed('ShiftRight'); }

  // Shooting: Arrow keys (direction)
  get shootLeft() { return this.isPressed('ArrowLeft'); }
  get shootRight() { return this.isPressed('ArrowRight'); }
  get shootUp() { return this.isPressed('ArrowUp'); }
  get shootDown() { return this.isPressed('ArrowDown'); }

  /** True if any arrow key is held (= player wants to shoot). */
  get shooting() {
    return this.shootLeft || this.shootRight || this.shootUp || this.shootDown;
  }

  /**
   * Returns normalized shoot direction vector, or null if not shooting.
   * Supports diagonals (e.g. ArrowUp + ArrowLeft).
   */
  getShootDir() {
    let dx = 0, dy = 0;
    if (this.shootLeft) dx -= 1;
    if (this.shootRight) dx += 1;
    if (this.shootUp) dy -= 1;
    if (this.shootDown) dy += 1;
    if (dx === 0 && dy === 0) return null;
    const len = Math.sqrt(dx * dx + dy * dy);
    return { x: dx / len, y: dy / len };
  }

  // Bomb: Space
  get bomb() { return this.wasJustPressed('Space'); }

  reset() {
    this.keys.clear();
    this._justPressed.clear();
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}
