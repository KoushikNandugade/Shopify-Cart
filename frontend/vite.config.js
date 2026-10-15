import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The browser talks to its own origin; Vite forwards API calls to Express.
const proxy = {
  '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true, rewrite: path => path.replace(/^\/api/, '') },
  '/product-images': { target: 'http://127.0.0.1:5000', changeOrigin: true },
  '/customers': { target: 'http://127.0.0.1:5000', changeOrigin: true },
  '/health': { target: 'http://127.0.0.1:5000', changeOrigin: true },
};
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, proxy },
  preview: { port: 4173, strictPort: true, proxy },
});
