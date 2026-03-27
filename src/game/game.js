import { gameBounds, PLAYER_HITBOX_RADIUS, MAX_ACTIVE_BULLETS } from '../utils/constants.js';
import { Renderer } from '../engine/renderer.js';
import { InputManager } from '../engine/input.js';
import { AudioEngine } from '../audio/audioEngine.js';
import { Player } from './player.js';
import { BulletSystem } from './bullet.js';
import { PatternSpawner } from './patterns.js';
import { ParticleSystem } from './particles.js';
import { Background } from './background.js';
import { NoteLanes } from './noteLanes.js';
import { GameState } from './gameState.js';

export class Game {
  constructor() {
    this.renderer = new Renderer();
    this.input = new InputManager();
    this.audio = new AudioEngine();
    this.player = new Player();
    this.bullets = new BulletSystem();
    this.patterns = new PatternSpawner(this.bullets);
    this.particles = new ParticleSystem();
    this.background = new Background();
    this.noteLanes = new NoteLanes();
    this.state = new GameState();
    this.midiData = null;

    // UI refs
    this.uploadScreen = document.getElementById('upload-screen');
    this.loadingIndicator = document.getElementById('loading-indicator');
    this.hud = document.getElementById('hud');
    this.livesEl = document.getElementById('lives');
    this.scoreEl = document.getElementById('score');
    this.songTitleEl = document.getElementById('song-title');
    this.gameOverScreen = document.getElementById('game-over-screen');
    this.gameOverStats = document.getElementById('game-over-stats');
    this.victoryScreen = document.getElementById('victory-screen');
    this.victoryStats = document.getElementById('victory-stats');

    this.lastFrameTime = 0;
    this._boundUpdate = this._update.bind(this);
  }

  async init() {
    const appEl = document.getElementById('app');
    await this.renderer.init(appEl);
    await this.audio.init();

    const stage = this.renderer.stage;
    stage.sortableChildren = true;
    stage.addChild(this.background.container);
    stage.addChild(this.bullets.container);
    stage.addChild(this.particles.container);
    stage.addChild(this.noteLanes.container);
    stage.addChild(this.player.container);

    this._setupUIHandlers();
  }

  _setupUIHandlers() {
    document.getElementById('btn-retry').addEventListener('click', () => {
      this.gameOverScreen.classList.remove('active');
      this._startGame();
    });
    document.getElementById('btn-replay').addEventListener('click', () => {
      this.victoryScreen.classList.remove('active');
      this._startGame();
    });
    document.getElementById('btn-new-song').addEventListener('click', () => {
      this.gameOverScreen.classList.remove('active');
      this._showUpload();
    });
    document.getElementById('btn-new-song-v').addEventListener('click', () => {
      this.victoryScreen.classList.remove('active');
      this._showUpload();
    });
  }

  async loadAndStart(midiData) {
    this.midiData = midiData;
    this.loadingIndicator.classList.add('active');
    await new Promise(r => setTimeout(r, 100));
    await this.audio.loadSong(midiData);
    this.loadingIndicator.classList.remove('active');
    this.uploadScreen.classList.add('hidden');
    await new Promise(r => setTimeout(r, 800));
    this._startGame();
  }

  async _startGame() {
    this.state.reset();
    this.state.songDuration = this.midiData.duration;
    this.state.songName = this.midiData.name;
    this.state.totalNotes = this.midiData.totalNotes;
    this.state.isPlaying = true;

    this.player.reset();
    this.bullets.clearAll();
    this.particles.clear();
    this.input.reset();

    this.audio.stop();
    await this.audio.loadSong(this.midiData);
    this.audio.play();

    this.hud.classList.add('active');
    this._updateHUD();
    this.songTitleEl.textContent = this.state.songName || 'Untitled';

    this.lastFrameTime = performance.now();
    this.renderer.ticker.add(this._boundUpdate);
  }

  _stopGame() {
    this.state.isPlaying = false;
    this.renderer.ticker.remove(this._boundUpdate);
    this.audio.stop();
  }

  _showUpload() {
    this._stopGame();
    this.hud.classList.remove('active');
    this.uploadScreen.classList.remove('hidden');
    this.bullets.clearAll();
    this.particles.clear();
  }

  _update() {
    if (!this.state.isPlaying) return;

    const now = performance.now();
    const rawDt = (now - this.lastFrameTime) / (1000 / 60);
    const dt = Math.min(rawDt, 3);
    this.lastFrameTime = now;

    this.state.currentTime = this.audio.getCurrentTime();
    const currentTime = this.state.currentTime;

    this._processNotes(currentTime);

    this.player.update(dt, this.input);
    this.bullets.update(dt, this.player.x, this.player.y);
    this.particles.update(dt);
    this.background.update(dt);
    this.noteLanes.update(dt);

    if (this.player.invulnTimer <= 0) {
      const hit = this.bullets.checkCollision(
        this.player.x, this.player.y, PLAYER_HITBOX_RADIUS
      );
      if (hit) {
        this._onPlayerHit();
      }
    }

    this._checkGraze();
    this.state.addScore(Math.floor(dt * 10));

    this.bullets.render();
    this.particles.render();
    this.noteLanes.render();

    if (Math.floor(now) % 3 === 0) {
      this._updateHUD();
    }

    if (currentTime >= this.state.songDuration + 3) {
      this._onVictory();
    }
  }

  _processNotes(currentTime) {
    const events = this.midiData.events;
    const startIdx = this.state.noteIndex;

    for (let i = startIdx; i < events.length; i++) {
      if (events[i].time > currentTime) break;

      const note = events[i];
      this.state.noteIndex = i + 1;
      this.state.notesSpawned++;

      if (this.bullets.activeCount >= MAX_ACTIVE_BULLETS) continue;

      // Spawn bullet pattern
      this.patterns.spawnForNote(note, this.player.x, this.player.y);

      // Spawn position uses full MIDI note: bass→left, treble→right
      const spawnX = (note.midi / 127) * gameBounds.width * 0.85 + gameBounds.width * 0.075;

      // Visual feedback: light up the spectrum lane at this note's position
      this.noteLanes.trigger(note.midi, note.velocity);

      // Spawn bloom and embers using full MIDI note for unique color
      this.particles.spawnBloom(spawnX, 4, note.midi, note.velocity);
      this.particles.spawnNoteEmber(note.midi, spawnX, note.velocity);
    }
  }

  _onPlayerHit() {
    const wasHit = this.player.hit();
    if (!wasHit) return;

    this.state.loseLife();
    this.particles.spawnHitRing(this.player.x, this.player.y);
    this.bullets.clearAll();

    if (this.state.isGameOver) {
      this.particles.spawnDeathBloom(this.player.x, this.player.y);
      setTimeout(() => {
        this._stopGame();
        this.gameOverStats.textContent =
          `Score: ${this.state.score.toLocaleString()} | Survived: ${this.state.survivalPercent}% of the song`;
        this.gameOverScreen.classList.add('active');
      }, 1500);
    }

    this._updateHUD();
  }

  _checkGraze() {
    const d = this.bullets.data;
    const px = this.player.x;
    const py = this.player.y;
    const grazeRange = 20;

    for (let i = 0; i < d.size; i++) {
      if (!d.alive[i]) continue;
      const dx = d.x[i] - px;
      const dy = d.y[i] - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < grazeRange && dist > PLAYER_HITBOX_RADIUS + d.radius[i]) {
        this.state.addScore(5);
        this.state.grazeCount++;
        if (Math.random() < 0.1) {
          this.particles.spawnGraze(d.x[i], d.y[i]);
        }
      }
    }
  }

  _onVictory() {
    this._stopGame();
    this.victoryStats.textContent =
      `Score: ${this.state.score.toLocaleString()} | Lives remaining: ${this.state.lives} | Grazes: ${this.state.grazeCount}`;
    this.victoryScreen.classList.add('active');
  }

  _updateHUD() {
    let livesHTML = '';
    for (let i = 0; i < 3; i++) {
      livesHTML += `<div class="life ${i >= this.state.lives ? 'lost' : ''}"></div>`;
    }
    this.livesEl.innerHTML = livesHTML;
    this.scoreEl.textContent = `Score: ${this.state.score.toLocaleString()}`;
  }
}
