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
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});
