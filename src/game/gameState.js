import { PLAYER_START_LIVES } from '../utils/constants.js';

/**
 * Central game state manager.
 */
export class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    this.lives = PLAYER_START_LIVES;
    this.score = 0;
    this.isPlaying = false;
    this.isGameOver = false;
    this.isVictory = false;
    this.currentTime = 0;
    this.noteIndex = 0;
    this.songDuration = 0;
    this.songName = '';
    this.totalNotes = 0;
    this.notesSpawned = 0;
    this.grazeCount = 0;
    this.bulletsDodged = 0;
    this.bombCharges = 3;
    this.bossHits = 0;
  }

  loseLife() {
    this.lives--;
    if (this.lives <= 0) {
      this.isGameOver = true;
      this.isPlaying = false;
    }
  }

  useBomb() {
    if (this.bombCharges <= 0) return false;
    this.bombCharges--;
    return true;
  }

  addScore(amount) {
    this.score += amount;
  }

  get survivalPercent() {
    if (this.songDuration <= 0) return 0;
    return Math.min(100, Math.floor((this.currentTime / this.songDuration) * 100));
  }
}
