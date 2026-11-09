import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173 },
  // Malaki talaga ang three.js; huwag nang mag-warn.
  build: { chunkSizeWarningLimit: 2000 },
});
