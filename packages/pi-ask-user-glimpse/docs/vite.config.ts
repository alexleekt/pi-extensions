import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname, '..'),
  base: './',
  build: {
    outDir: './docs/dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        changelog: resolve(__dirname, 'changelog.html'),
        roadmap: resolve(__dirname, 'roadmap.html'),
        glossary: resolve(__dirname, 'glossary.html'),
        readme: resolve(__dirname, 'readme.html'),
      },
    },
  },
});
