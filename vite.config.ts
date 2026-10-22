import { defineConfig } from 'vite';
export default defineConfig({
  server: { host:'127.0.0.1', watch:{ ignored:['**/runtime/**','**/release/**'] } },
  // Generated packages and extracted acceptance copies are not app entries.
  optimizeDeps: { entries:['index.html'] },
  build: { target:'es2022' },
});
