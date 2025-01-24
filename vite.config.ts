import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  resolve: {
    alias: {
      // This fixes issues with the Buffer polyfill
      buffer: 'buffer/',
    },
  },
  define: {
    // This ensures proper Buffer definition in the browser
    'process.env.BROWSER': true,
    'global': {},
  },
});