import { defineConfig } from 'vite';

export default defineConfig({
  base: '/midi-game/',
  server: { port: 3000 },
  build: { target: 'esnext' },
});
