import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        study: resolve(__dirname, 'study.html'),
        mentorship: resolve(__dirname, 'mentorship.html'),
        test: resolve(__dirname, 'test.html'),
        admin: resolve(__dirname, 'admin.html'),
        player: resolve(__dirname, 'player.html'),
        live: resolve(__dirname, 'live.html'),
        cbt: resolve(__dirname, 'cbt-test.html'),
      },
    },
  },
});
