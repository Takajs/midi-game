import { Application, Container } from 'pixi.js';
import { gameBounds } from '../utils/constants.js';

/**
 * Fullscreen renderer — 1:1 pixel mapping, no scaling.
 * Updates gameBounds on resize so all systems use live dimensions.
 */
export class Renderer {
  constructor() {
    this.app = null;
    this.gameContainer = null;
  }

  async init(parentElement) {
    this.app = new Application();

    await this.app.init({
      background: 0x05050e,
      resizeTo: window,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      powerPreference: 'high-performance',
    });

    parentElement.prepend(this.app.canvas);
    this.app.canvas.style.position = 'absolute';
    this.app.canvas.style.top = '0';
    this.app.canvas.style.left = '0';
    this.app.canvas.style.zIndex = '0';

    this.gameContainer = new Container();
    this.app.stage.addChild(this.gameContainer);

    this._updateBounds();
    window.addEventListener('resize', () => this._updateBounds());

    return this;
  }

  _updateBounds() {
    gameBounds.width = window.innerWidth;
    gameBounds.height = window.innerHeight;
  }

  get stage() {
    return this.gameContainer;
  }

  get ticker() {
    return this.app.ticker;
  }

  destroy() {
    this.app.destroy(true);
  }
}
