import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      // JSON.stringify is crucial here to wrap the values in quotes for the browser
      // We default API_KEY to empty string to ensure the token is replaced even if env var is missing
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
      'process.env.SUPABASE_URL': JSON.stringify('https://pemefhucwmizzttgibcm.supabase.co'),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify('sb_publishable_P_6Taa7vzhn6LcKxF0kYbg_KYXNsowX')
    },
    server: {
      proxy: {
        // Proxy API requests to the local Express server during development
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        }
      }
    }
  };
});