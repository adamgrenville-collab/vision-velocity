import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // The whole point of this project: JSX is compiled here, never on the phone.
    target: 'es2018',
    outDir: 'dist'
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js']
  }
});
