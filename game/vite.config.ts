import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173 },
  // Malaki talaga ang Phaser; huwag nang mag-warn.
  build: { chunkSizeWarningLimit: 2000 },
});
