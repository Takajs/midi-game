/**
 * Keyboard input manager.
 * Tracks which keys are currently pressed.
 */
export class InputManager {
  constructor() {
    this.keys = new Set();
    this._onKeyDown = (e) => {
      this.keys.add(e.code);
      // Prevent arrow keys from scrolling
      if (e.code.startsWith('Arrow') || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        e.preventDefault();
      }
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  isPressed(code) {
    return this.keys.has(code);
  }

  get left() { return this.isPressed('ArrowLeft'); }
  get right() { return this.isPressed('ArrowRight'); }
  get up() { return this.isPressed('ArrowUp'); }
  get down() { return this.isPressed('ArrowDown'); }
  get focus() { return this.isPressed('ShiftLeft') || this.isPressed('ShiftRight'); }

  reset() {
    this.keys.clear();
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}
