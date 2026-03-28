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
import { Graphics } from 'pixi.js';

// ─── Player shot constants ───
const SHOT_SPEED = 7;
const SHOT_RADIUS = 3;
const SHOT_COOLDOWN = 5; // frames between shots
const MAX_PLAYER_SHOTS = 60;

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
    this.theme = null;

    // Wire boss to patterns
    this.patterns.boss = this.boss;

    // Player shots (simple array, not SoA — low count)
    this.playerShots = [];
    this.shotCooldown = 0;

    // UI
    this.uploadScreen = document.getElementById('upload-screen');
    this.loadingIndicator = document.getElementById('loading-indicator');
    this.hud = document.getElementById('hud');
    this.livesEl = document.getElementById('lives');
    this.bombsEl = document.getElementById('bombs');
    this.scoreEl = document.getElementById('score');
    this.songTitleEl = document.getElementById('song-title');
    this.gameOverScreen = document.getElementById('game-over-screen');
    this.gameOverStats = document.getElementById('game-over-stats');
    this.victoryScreen = document.getElementById('victory-screen');
    this.victoryStats = document.getElementById('victory-stats');
    this.scorePopupsEl = document.getElementById('score-popups');
    this.milestoneEl = document.getElementById('milestone-notify');

    this.lastFrameTime = 0;
    this._boundUpdate = this._update.bind(this);

    // Beam look-ahead
    this._beamLookahead = 0;
    this._beamWarned = new Set();

    // Bolt cooldown
    this._boltCooldown = 0;

    // Audio reactivity
    this._bassPulse = 0;

    // Player shot graphics (PixiJS)
    this._shotGfx = null;
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

    // Player shot layer — above bullets, below player
    this._shotGfx = new Graphics();
    this._shotGfx.zIndex = 90;
    stage.addChild(this._shotGfx);

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

  async loadAndStart(midiData, levelTheme) {
    this.midiData = midiData;
    this.theme = levelTheme;
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
    this.playerShots.length = 0;
    this.shotCooldown = 0;
    this._beamLookahead = 0;
    this._beamWarned.clear();
    this._boltCooldown = 0;
    this._bassPulse = 0;

    // Clear score popups
    this.scorePopupsEl.innerHTML = '';

    // Apply level theme
    const themeColors = this.theme ? this.theme.colors : null;
    const themeGameplay = this.theme ? this.theme.gameplay : null;
    this.background.setTheme(themeColors);
    this.patterns.theme = themeGameplay;
    if (this.theme && this.theme.bossColor !== undefined) {
      this.bullets.tintColor = this.theme.bossColor;
      this.bullets.tintBlend = 0.3;
    } else {
      this.bullets.tintColor = 0;
      this.bullets.tintBlend = 0;
    }

    // Configure boss with pre-computed script
    this.boss.reset();
    if (this.theme) {
      if (this.theme.bossColor !== undefined) {
        this.boss.color = this.theme.bossColor;
        this._tintBossColors(this.songAnalysis, this.theme.bossColor);
      }
      // Per-planet boss size
      if (this.theme.boss) {
        const scale = this.theme.boss.scale || 1;
        if (scale !== 1) {
          const radii = this.songAnalysis.bossRadius;
          for (let i = 0; i < radii.length; i++) radii[i] *= scale;
        }
        this.boss.hasRing = !!this.theme.boss.ring;
        this.boss.spikeStyle = this.theme.boss.spikes || 'default';
      }
    }
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
    this.renderer.stage.scale.set(1, 1);
  }

  _showUpload() {
    this._stopGame();
    this.hud.classList.remove('active');
    this.uploadScreen.classList.remove('hidden');
    this.bullets.clearAll();
    this.particles.clear();
    this.effects.clear();
    this.playerShots.length = 0;
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

    // Player shooting
    this._updatePlayerShooting(dt);

    // Bomb
    if (this.input.bomb) {
      this._activateBomb();
    }

    this.player.update(dt, this.input);
    this.boss.update(dt, currentTime, this.player.x, this.player.y);
    this.effects.applyWells(this.bullets.data);
    this.bullets.update(dt, this.player.x, this.player.y);
    this.effects.update(dt, this.renderer.stage);
    this.particles.update(dt);
    this.background.update(dt);

    // ── Audio reactivity ──
    if (this.songAnalysis) {
      const wi = Math.min(
        Math.floor(currentTime / this.songAnalysis.windowSize),
        this.songAnalysis.windowCount - 1
      );
      const density = this.songAnalysis.density[Math.max(0, wi)];
      this.background.setIntensity(density);

      // Ambient motes during quiet passages
      if (density < 0.2 && Math.random() < 0.12) {
        const moteColor = this.theme ? this.theme.bossColor : 0x8888cc;
        this.particles.spawnAmbientMote(moteColor);
      }
    }

    // Bass pulse — subtle zoom on heavy bass hits
    if (this._bassPulse > 0.001) {
      const s = 1 + this._bassPulse;
      this.renderer.stage.scale.set(s, s);
      this._bassPulse *= Math.pow(0.8, dt);
    } else if (this._bassPulse > 0) {
      this._bassPulse = 0;
      this.renderer.stage.scale.set(1, 1);
    }

    // Player shots → boss collision
    this._updatePlayerShots(dt);

    // Bomb ring clearing bullets
    this._updateBombClearing();

    // Player collision with enemy bullets
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
    this._checkMilestone();

    // Render
    this.bullets.render();
    this.effects.render();
    this.particles.render();
    this.boss.render(this.player.x, this.player.y);
    this._renderPlayerShots();

    if (Math.floor(now) % 3 === 0) this._updateHUD();
    if (currentTime >= this.state.songDuration + 3) this._onVictory();
  }

  // ─── Player shooting ───

  _updatePlayerShooting(dt) {
    if (this.shotCooldown > 0) this.shotCooldown -= dt;

    const dir = this.input.getShootDir();
    if (dir && this.shotCooldown <= 0 &&
        this.playerShots.length < MAX_PLAYER_SHOTS) {
      // Twin-shot with slight perpendicular offset
      const perpX = -dir.y * 5;
      const perpY = dir.x * 5;
      this.playerShots.push({
        x: this.player.x + perpX,
        y: this.player.y + perpY,
        vx: dir.x * SHOT_SPEED,
        vy: dir.y * SHOT_SPEED,
      });
      this.playerShots.push({
        x: this.player.x - perpX,
        y: this.player.y - perpY,
        vx: dir.x * SHOT_SPEED,
        vy: dir.y * SHOT_SPEED,
      });

      this.shotCooldown = SHOT_COOLDOWN;
    }
  }

  _updatePlayerShots(dt) {
    for (let i = this.playerShots.length - 1; i >= 0; i--) {
      const s = this.playerShots[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      // Out of bounds
      if (s.x < -20 || s.x > gameBounds.width + 20 ||
          s.y < -20 || s.y > gameBounds.height + 20) {
        this.playerShots.splice(i, 1);
        continue;
      }

      // Boss dodge (react to nearby shots)
      const dxB = s.x - this.boss.x;
      const dyB = s.y - this.boss.y;
      const distB = Math.sqrt(dxB * dxB + dyB * dyB);
      if (distB < this.boss.radius * 2.5) {
        this.boss.dodge(s.x, s.y);
      }

      // Hit detection
      const hit = this.boss.checkHit(s.x, s.y, SHOT_RADIUS);
      if (hit) {
        this.state.addScore(hit.points);
        this.state.bossHits++;
        this._spawnScorePopup(s.x, s.y, hit.points, hit.isEye);
        this.playerShots.splice(i, 1);

        // Hit particles
        this.particles.spawnHitRing(s.x, s.y);
      }
    }
  }

  _renderPlayerShots() {
    const g = this._shotGfx;
    if (!g) return;
    g.clear();

    for (const s of this.playerShots) {
      // Glow
      g.circle(s.x, s.y, SHOT_RADIUS * 2.5);
      g.fill({ color: 0x60a5fa, alpha: 0.12 });
      // Core
      g.circle(s.x, s.y, SHOT_RADIUS);
      g.fill({ color: 0xaaccff, alpha: 0.85 });
      // Bright center
      g.circle(s.x, s.y, SHOT_RADIUS * 0.4);
      g.fill({ color: 0xffffff, alpha: 0.95 });
    }
  }

  // ─── Bomb ───

  _activateBomb() {
    if (!this.state.useBomb()) return;

    this.effects.addBombRing(this.player.x, this.player.y);
    this.effects.shake(4);
    this._updateHUD();
  }

  _updateBombClearing() {
    const ringR = this.effects.getBombRingRadius();
    if (ringR <= 0) return;

    const pos = this.effects.getBombRingPos();
    if (!pos) return;

    const d = this.bullets.data;
    const hw = this.bullets.highWater;

    for (let i = 0; i < hw; i++) {
      if (!d.alive[i]) continue;
      const dx = d.x[i] - pos.x;
      const dy = d.y[i] - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Clear bullets inside the ring (with a small buffer)
      if (dist < ringR + 10) {
        this.bullets._kill(i);
        this.state.bulletsDodged++;
      }
    }
  }

  // ─── Score popups (DOM-based, CSS animated) ───

  _spawnScorePopup(x, y, points, isEye) {
    const el = document.createElement('div');
    el.className = `score-popup ${isEye ? 'eye-hit' : 'body-hit'}`;
    el.textContent = `+${points}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.scorePopupsEl.appendChild(el);

    // Remove after animation completes
    el.addEventListener('animationend', () => el.remove());
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

      // Bass notes — impact, shake, bolts
      if (note.octave <= 2 && note.velocity > 0.72 && this._boltCooldown <= 0) {
        const color = noteColor(note.midi);
        this.effects.addBolt(spawnX, color);
        this.effects.shake(note.velocity * 3);
        this.particles.spawnBoltSpark(spawnX, 0, color);
        this.particles.spawnBoltSpark(spawnX, gameBounds.height, color);
        this._boltCooldown = 40;
        this._bassPulse = Math.min(this._bassPulse + 0.006, 0.012);
      }
      else if (note.octave <= 2 && note.velocity > 0.55) {
        this.effects.shake(note.velocity * 1.5);
        this._bassPulse = Math.min(this._bassPulse + 0.004, 0.01);
      }

      // Bass impact particles
      if (note.octave <= 2 && note.velocity > 0.5) {
        const ep = this.boss.getEmitPoint();
        this.particles.spawnBassImpact(ep.x, ep.y, note.velocity, noteColor(note.midi));
      }

      // High note sparkles
      if (note.octave >= 6) {
        const ep = this.boss.getEmitPoint();
        this.particles.spawnHighSparkle(ep.x, ep.y);
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
        if (Math.random() < 0.25) this.particles.spawnGraze(d.x[i], d.y[i]);
      }
    }
  }

  _onVictory() {
    this._stopGame();
    this.victoryStats.textContent =
      `Score: ${this.state.score.toLocaleString()} | Lives remaining: ${this.state.lives} | Grazes: ${this.state.grazeCount} | Boss hits: ${this.state.bossHits}`;
    this.victoryScreen.classList.add('active');
  }

  _checkMilestone() {
    const milestone = Math.floor(this.state.score / 75000);
    if (milestone <= this.state.lastMilestone) return;
    this.state.lastMilestone = milestone;

    // Randomly award life or bomb
    const isLife = Math.random() < 0.5;
    if (isLife) {
      this.state.lives++;
    } else {
      this.state.bombCharges++;
    }
    this._updateHUD();

    // Quick reward chime via Tone.js
    this._playRewardChime();

    // Visual notification
    const el = this.milestoneEl;
    el.textContent = isLife ? '+1 Life' : '+1 Bomb';
    el.className = 'milestone-notify active ' + (isLife ? 'life-reward' : 'bomb-reward');
    // Reset animation
    el.offsetWidth; // force reflow
    el.classList.add('animate');
    clearTimeout(this._milestoneTimeout);
    this._milestoneTimeout = setTimeout(() => {
      el.classList.remove('active', 'animate');
    }, 2200);

    // Particles burst at player
    this.particles.spawnHitRing(this.player.x, this.player.y);
  }

  _playRewardChime() {
    try {
      const now = this.audio._started ? undefined : undefined;
      // Use existing Tone.js — create a quick disposable synth
      import('tone').then(Tone => {
        const synth = new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: { attack: 0.01, decay: 0.15, sustain: 0.1, release: 0.3 },
          volume: -8,
        }).toDestination();
        synth.triggerAttackRelease('C6', '8n');
        setTimeout(() => {
          synth.triggerAttackRelease('E6', '8n');
        }, 100);
        setTimeout(() => {
          synth.triggerAttackRelease('G6', '8n');
          setTimeout(() => synth.dispose(), 500);
        }, 200);
      });
    } catch { /* ignore audio errors */ }
  }

  _updateHUD() {
    const maxLives = Math.max(3, this.state.lives);
    let livesHTML = '';
    for (let i = 0; i < maxLives; i++) {
      livesHTML += `<div class="life ${i >= this.state.lives ? 'lost' : ''}"></div>`;
    }
    this.livesEl.innerHTML = livesHTML;

    const maxBombs = Math.max(3, this.state.bombCharges);
    let bombsHTML = '';
    for (let i = 0; i < maxBombs; i++) {
      bombsHTML += `<div class="bomb-charge ${i >= this.state.bombCharges ? 'used' : ''}"></div>`;
    }
    this.bombsEl.innerHTML = bombsHTML;

    this.scoreEl.textContent = `Score: ${this.state.score.toLocaleString()}`;
  }

  _tintBossColors(analysis, themeColor) {
    if (!analysis || !analysis.bossColor) return;
    const tr = (themeColor >> 16) & 0xff;
    const tg = (themeColor >> 8) & 0xff;
    const tb = themeColor & 0xff;
    const blend = 0.45; // 45% theme, 55% original
    const colors = analysis.bossColor;
    for (let i = 0; i < colors.length; i++) {
      const or = (colors[i] >> 16) & 0xff;
      const og = (colors[i] >> 8) & 0xff;
      const ob = colors[i] & 0xff;
      const r = Math.round(or * (1 - blend) + tr * blend);
      const g = Math.round(og * (1 - blend) + tg * blend);
      const b = Math.round(ob * (1 - blend) + tb * blend);
      colors[i] = (r << 16) | (g << 8) | b;
    }
  }
}
