import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: '[https://attendance-management-erp.onrender.com](https://attendance-management-erp.onrender.com)',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
