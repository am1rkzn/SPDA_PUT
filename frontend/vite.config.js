import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Прокси для разработки: запросы фронтенда на /api уходят на Backend (FastAPI).
    // Поменяй порт, если Backend запущен иначе (по умолчанию FastAPI — 8000).
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
