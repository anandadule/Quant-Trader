import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      // This ensures the Google GenAI SDK can access process.env.API_KEY in the browser
      'process.env': {
        API_KEY: env.API_KEY,
        FYERS_APP_ID: env.FYERS_APP_ID,
        FYERS_ACCESS_TOKEN: env.FYERS_ACCESS_TOKEN
      }
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