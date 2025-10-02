import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const entryHtml = fileURLToPath(new URL('./index.html', import.meta.url));
const entryJs = fileURLToPath(new URL('./src/main.js', import.meta.url));

export default defineConfig({
  server: {
    port: 5173,
    fs: {
      deny: ['.env', '.env.*', 'node_modules', 'modules'],
    },
  },
  optimizeDeps: {
    entries: [entryJs],
  },
  build: {
    rollupOptions: {
      input: entryHtml,
    },
  },
});
