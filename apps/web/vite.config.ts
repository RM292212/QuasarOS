import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@quasar/client': path.resolve(__dirname, '../../packages/client/src'),
      '@quasar/runtime': path.resolve(__dirname, '../../packages/runtime/src'),
      '@quasar/renderer-webgpu': path.resolve(__dirname, '../../packages/renderer-webgpu/src'),
      '@quasar/renderer-webgl2': path.resolve(__dirname, '../../packages/renderer-webgl2/src'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
