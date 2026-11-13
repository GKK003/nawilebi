import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VERCEL': JSON.stringify(process.env.VERCEL === '1'),
    'import.meta.env.VERCEL_OBSERVABILITY_CLIENT_CONFIG': JSON.stringify(process.env.VERCEL_OBSERVABILITY_CLIENT_CONFIG ?? ''),
  },
});
