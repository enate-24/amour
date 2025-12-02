import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    // Add CORS headers to prevent extension conflicts
    cors: true,
    // Configure HMR to be more stable
    hmr: {
      overlay: false
    },
    // Proxy API requests to backend server
    proxy: {
      '/api': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        secure: false
      }
    }
  }
});
