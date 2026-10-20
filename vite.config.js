import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 多页构建：每个游戏独立 URL + 独立 title/meta，便于 SEO 收录
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        minesweeper: resolve(__dirname, 'minesweeper/index.html'),
        'sonar-maze': resolve(__dirname, 'sonar-maze/index.html'),
        'kitchen-defense': resolve(__dirname, 'kitchen-defense/index.html'),
        about: resolve(__dirname, 'about/index.html'),
        privacy: resolve(__dirname, 'privacy/index.html'),
        contact: resolve(__dirname, 'contact/index.html'),
      },
    },
  },
});
