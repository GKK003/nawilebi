import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { renderShareMetadata } from './server/share-metadata.ts';

export default defineConfig({
  plugins: [react(), { name: 'share-metadata', transformIndexHtml: (html) => renderShareMetadata(html) }],
  define: {
    'import.meta.env.VERCEL': JSON.stringify(process.env.VERCEL === '1'),
    'import.meta.env.VERCEL_OBSERVABILITY_CLIENT_CONFIG': JSON.stringify(process.env.VERCEL_OBSERVABILITY_CLIENT_CONFIG ?? ''),
  },
});
