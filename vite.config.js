import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const path = id.replaceAll('\\\\', '/');
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(path)) return 'framework';
          if (path.includes('/node_modules/lucide-react/')) return 'icons';
          if (path.includes('/node_modules/@supabase/')) return 'supabase';
        },
      },
    },
  },
});
