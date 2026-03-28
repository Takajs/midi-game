import { Game } from './game/game.js';
import { parseMidi } from './audio/midiParser.js';
import { LEVELS } from './game/levelThemes.js';

async function main() {
  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('midi-input');
  const levelGrid = document.getElementById('level-grid');

  let game = null;
  let gameReady = false;
  let pendingFile = null;

  // ── Build level selector UI ──
  for (const level of LEVELS) {
    const card = document.createElement('div');
    card.className = 'level-card';
    card.dataset.levelId = level.id;

    const orb = document.createElement('div');
    orb.className = 'level-orb' + (level.css.ring ? ' has-ring' : '');
    orb.style.background = level.css.gradient;
    orb.style.setProperty('--glow', level.css.glow);
    card.style.setProperty('--glow', level.css.glow);

    const name = document.createElement('div');
    name.className = 'level-name';
    name.textContent = level.name;

    const diff = document.createElement('div');
    diff.className = 'level-diff';
    for (let i = 0; i < 5; i++) {
      const dot = document.createElement('div');
      dot.className = 'dot' + (i < level.difficulty ? ' filled' : '');
      diff.appendChild(dot);
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'level-tooltip';
    tooltip.innerHTML =
      `<div class="tt-name">${level.name}</div>` +
      `<div class="tt-sub">${level.subtitle}</div>`;

    card.appendChild(tooltip);
    card.appendChild(orb);
    card.appendChild(name);
    card.appendChild(diff);
    levelGrid.appendChild(card);

    card.addEventListener('click', () => handleLevel(level));
  }

  // ── Upload handlers ──
  uploadZone.addEventListener('click', (e) => {
    if (e.target === fileInput) return;
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
    fileInput.value = '';
  });

  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.add('dragover');
  });
  uploadZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
  });
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());

  async function handleFile(file) {
    if (!file.name.match(/\.(mid|midi)$/i)) {
      alert('Please upload a .mid or .midi file');
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const midiData = parseMidi(arrayBuffer);

      if (midiData.events.length === 0) {
        alert('This MIDI file contains no notes.');
        return;
      }

      console.log(`Loaded: ${midiData.name} | ${midiData.totalNotes} notes | ${midiData.duration.toFixed(1)}s | ${midiData.trackCount} tracks`);

      if (gameReady) {
        await game.loadAndStart(midiData, null);
      } else {
        pendingFile = midiData;
      }
    } catch (err) {
      console.error('Failed to parse MIDI:', err);
      alert('Failed to parse MIDI file. Please try another file.');
    }
  }

  async function handleLevel(level) {
    if (!gameReady) return;

    const loadingEl = document.getElementById('loading-indicator');
    loadingEl.classList.add('active');

    try {
      const basePath = import.meta.env.BASE_URL || '/';
      const url = `${basePath}levels/${level.file}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      const midiData = parseMidi(arrayBuffer);

      if (midiData.events.length === 0) {
        alert('This level file contains no notes.');
        loadingEl.classList.remove('active');
        return;
      }

      // Override name with level display name
      midiData.name = level.name;

      console.log(`Level: ${level.name} | ${midiData.totalNotes} notes | ${midiData.duration.toFixed(1)}s`);

      await game.loadAndStart(midiData, level);
    } catch (err) {
      console.error('Failed to load level:', err);
      alert('Failed to load level. Please try again.');
      loadingEl.classList.remove('active');
    }
  }

  // ── Init game engine ──
  try {
    game = new Game();
    await game.init();
    gameReady = true;
    console.log('Game engine ready');

    if (pendingFile) {
      await game.loadAndStart(pendingFile, null);
      pendingFile = null;
    }
  } catch (err) {
    console.error('Game init failed:', err);
  }
}

main().catch(console.error);
