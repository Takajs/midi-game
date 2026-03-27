import { Game } from './game/game.js';
import { parseMidi } from './audio/midiParser.js';

async function main() {
  // Set up upload handlers FIRST, before game init (which may take time)
  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('midi-input');

  let game = null;
  let gameReady = false;
  let pendingFile = null;

  // Click to upload
  uploadZone.addEventListener('click', (e) => {
    // Avoid re-triggering if clicking the input itself
    if (e.target === fileInput) return;
    fileInput.click();
  });

  // File selected
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
    // Reset so the same file can be re-selected
    fileInput.value = '';
  });

  // Drag and drop
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

  // Also prevent default drag on the document to avoid browser opening the file
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
        await game.loadAndStart(midiData);
      } else {
        // Game still initializing, queue the file
        pendingFile = midiData;
      }
    } catch (err) {
      console.error('Failed to parse MIDI:', err);
      alert('Failed to parse MIDI file. Please try another file.');
    }
  }

  // Now init the game engine
  try {
    game = new Game();
    await game.init();
    gameReady = true;
    console.log('Game engine ready');

    // If a file was uploaded while we were initializing
    if (pendingFile) {
      await game.loadAndStart(pendingFile);
      pendingFile = null;
    }
  } catch (err) {
    console.error('Game init failed:', err);
  }
}

main().catch(console.error);
