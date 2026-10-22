import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

export default defineConfig({
  // Relative asset paths, so the build works from GitHub Pages' /RAG-Pipeline/ path.
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
  },
});
