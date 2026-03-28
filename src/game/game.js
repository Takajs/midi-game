import { gameBounds, PLAYER_HITBOX_RADIUS, MAX_ACTIVE_BULLETS } from '../utils/constants.js';
import { configure as configureNoteRange, noteToX } from '../utils/noteRange.js';
import { noteColor } from '../utils/noteColor.js';
import { Renderer } from '../engine/renderer.js';
import { InputManager } from '../engine/input.js';
import { AudioEngine } from '../audio/audioEngine.js';
import { Player } from './player.js';
import { BulletSystem } from './bullet.js';
import { PatternSpawner } from './patterns.js';
import { ParticleSystem } from './particles.js';
import { EffectsSystem } from './effects.js';
import { Background } from './background.js';
import { Boss } from './boss.js';
import { GameState } from './gameState.js';
import { analyzeSong } from './songAnalyzer.js';

export class Game {
  constructor() {
    this.renderer = new Renderer();
    this.input = new InputManager();
    this.audio = new AudioEngine();
    this.player = new Player();
    this.bullets = new BulletSystem();
    this.patterns = new PatternSpawner(this.bullets);
    this.particles = new ParticleSystem();
    this.effects = new EffectsSystem();
    this.background = new Background();
    this.boss = new Boss();
    this.state = new GameState();
    this.midiData = null;
    this.songAnalysis = null;

    // Wire boss to patterns
    this.patterns.boss = this.boss;

    // UI
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

    // Beam look-ahead
    this._beamLookahead = 0;
    this._beamWarned = new Set();

    // Bolt cooldown
    this._boltCooldown = 0;
  }

  async init() {
    const appEl = document.getElementById('app');
    await this.renderer.init(appEl);
    await this.audio.init();

    const stage = this.renderer.stage;
    stage.sortableChildren = true;
    stage.addChild(this.background.container);
    stage.addChild(this.boss.container);
    stage.addChild(this.bullets.container);
    stage.addChild(this.effects.container);
    stage.addChild(this.particles.container);
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

    // Pre-analyze the entire song during loading
    this.songAnalysis = analyzeSong(
      midiData.events, midiData.duration,
      midiData.midiMin, midiData.midiMax, midiData.bpm
    );

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

    configureNoteRange(this.midiData.midiMin, this.midiData.midiMax);

    this.player.reset();
    this.bullets.clearAll();
    this.particles.clear();
    this.effects.clear();
    this.input.reset();
    this._beamLookahead = 0;
    this._beamWarned.clear();
    this._boltCooldown = 0;

    // Configure boss with pre-computed script
    this.boss.reset();
    this.boss.setScript(this.songAnalysis, this.midiData.midiMin, this.midiData.midiMax);

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
    this.renderer.stage.position.set(0, 0);
  }

  _showUpload() {
    this._stopGame();
    this.hud.classList.remove('active');
    this.uploadScreen.classList.remove('hidden');
    this.bullets.clearAll();
    this.particles.clear();
    this.effects.clear();
  }

  // ─── Main loop ───

  _update() {
    if (!this.state.isPlaying) return;

    const now = performance.now();
    const rawDt = (now - this.lastFrameTime) / (1000 / 60);
    const dt = Math.min(rawDt, 3);
    this.lastFrameTime = now;

    this.state.currentTime = this.audio.getCurrentTime();
    const currentTime = this.state.currentTime;

    if (this._boltCooldown > 0) this._boltCooldown -= dt;

    this._processNotes(currentTime);
    this._processBeamLookahead(currentTime);

    this.player.update(dt, this.input);
    this.boss.update(dt, currentTime, this.player.x, this.player.y);
    this.effects.applyWells(this.bullets.data);
    this.bullets.update(dt, this.player.x, this.player.y);
    this.effects.update(dt, this.renderer.stage);
    this.particles.update(dt);
    this.background.update(dt);

    // Collision
    if (this.player.invulnTimer <= 0) {
      const bulletHit = this.bullets.checkCollision(
        this.player.x, this.player.y, PLAYER_HITBOX_RADIUS
      );
      if (bulletHit) {
        this._onPlayerHit();
      } else {
        const effectHit = this.effects.checkCollision(
          this.player.x, this.player.y, PLAYER_HITBOX_RADIUS
        );
        if (effectHit) this._onPlayerHit();
      }
    }

    this._checkGraze();
    this.state.addScore(Math.floor(dt * 10));

    // Render
    this.bullets.render();
    this.effects.render();
    this.particles.render();
    this.boss.render(this.player.x, this.player.y);

    if (Math.floor(now) % 3 === 0) this._updateHUD();
    if (currentTime >= this.state.songDuration + 3) this._onVictory();
  }

  // ─── Note processing ───

  _processNotes(currentTime) {
    const events = this.midiData.events;
    const startIdx = this.state.noteIndex;

    for (let i = startIdx; i < events.length; i++) {
      if (events[i].time > currentTime) break;

      const note = events[i];
      this.state.noteIndex = i + 1;
      this.state.notesSpawned++;

      const spawnX = noteToX(note.midi);

      if (this.bullets.activeCount < MAX_ACTIVE_BULLETS) {
        this.patterns.spawnForNote(note, this.player.x, this.player.y);
      }

      // Visual feedback
      this.particles.spawnBloom(spawnX, 4, note.midi, note.velocity);
      this.particles.spawnNoteEmber(note.midi, spawnX, note.velocity);

      // Thunderbolt
      if (note.octave <= 2 && note.velocity > 0.72 && this._boltCooldown <= 0) {
        const color = noteColor(note.midi);
        this.effects.addBolt(spawnX, color);
        this.effects.shake(note.velocity * 3);
        this.particles.spawnBoltSpark(spawnX, 0, color);
        this.particles.spawnBoltSpark(spawnX, gameBounds.height, color);
        this._boltCooldown = 40;
      }
      else if (note.octave <= 2 && note.velocity > 0.55) {
        this.effects.shake(note.velocity * 1.5);
      }

      // Gravity well
      if (note.octave <= 1 && note.velocity > 0.45) {
        this.effects.addWell(spawnX, gameBounds.height * 0.3,
          note.velocity * 3, 50 + note.velocity * 35);
      }
    }
  }

  // ─── Beam look-ahead ───

  _processBeamLookahead(currentTime) {
    const events = this.midiData.events;
    const lookahead = 2.0;

    while (this._beamLookahead < events.length) {
      const note = events[this._beamLookahead];
      if (note.time > currentTime + lookahead) break;
      if (note.time < currentTime) { this._beamLookahead++; continue; }

      if (note.duration > 1.2 && note.velocity > 0.55 &&
          !this._beamWarned.has(this._beamLookahead)) {
        this._beamWarned.add(this._beamLookahead);

        const x = noteToX(note.midi);
        const color = noteColor(note.midi);
        const timeUntil = note.time - currentTime;
        const warmup = Math.max(25, timeUntil * 60);
        const active = Math.min(40, note.duration * 20);
        const width = 20 + note.velocity * 18;

        this.effects.addBeam(x, width, warmup, active, color);
        this.particles.spawnBeamShimmer(x, color);
      }
      this._beamLookahead++;
    }
  }

  // ─── Player hit ───

  _onPlayerHit() {
    const wasHit = this.player.hit();
    if (!wasHit) return;

    this.state.loseLife();
    this.particles.spawnHitRing(this.player.x, this.player.y);
    this.effects.shake(6);
    this.bullets.clearAll();

    if (this.state.isGameOver) {
      this.particles.spawnDeathBloom(this.player.x, this.player.y);
      this.effects.shake(10);
      setTimeout(() => {
        this._stopGame();
        this.gameOverStats.textContent =
          `Score: ${this.state.score.toLocaleString()} | Survived: ${this.state.survivalPercent}% of the song`;
        this.gameOverScreen.classList.add('active');
      }, 1500);
    }
    this._updateHUD();
  }

  // ─── Graze ───

  _checkGraze() {
    const d = this.bullets.data;
    const px = this.player.x, py = this.player.y;
    const grazeRange = 20;
    const hw = this.bullets.highWater;

    for (let i = 0; i < hw; i++) {
      if (!d.alive[i]) continue;
      const dx = d.x[i] - px, dy = d.y[i] - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < grazeRange && dist > PLAYER_HITBOX_RADIUS + d.radius[i]) {
        this.state.addScore(5);
        this.state.grazeCount++;
        if (Math.random() < 0.08) this.particles.spawnGraze(d.x[i], d.y[i]);
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
