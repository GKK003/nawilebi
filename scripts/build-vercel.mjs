import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { build, loadEnv } from 'vite';
import vercelConfig from '../vercel.json' with { type: 'json' };

const output = '.vercel/output';
const functionPath = `${output}/functions/api/part-page.func`;
const env = loadEnv('production', process.cwd(), 'VITE_SUPABASE_');

await rm(output, { recursive: true, force: true });
await mkdir(functionPath, { recursive: true });
await cp('dist', `${output}/static`, { recursive: true });
await cp('dist/index.html', `${functionPath}/index.html`);

// Bundle the handler beside the HTML from this build so their asset URLs stay in sync.
await build({
  configFile: false,
  define: {
    'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL ?? ''),
    'process.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''),
  },
  build: {
    ssr: 'server/part-page.ts',
    outDir: functionPath,
    emptyOutDir: false,
    copyPublicDir: false,
    rolldownOptions: { output: { entryFileNames: 'index.mjs' } },
  },
});

await writeFile(`${functionPath}/.vc-config.json`, JSON.stringify({
  runtime: 'nodejs24.x',
  handler: 'index.mjs',
  launcherType: 'Nodejs',
  shouldAddHelpers: false,
}));
await writeFile(`${output}/config.json`, JSON.stringify({
  version: 3,
  routes: [
    { src: '^/part/([^/]+)/?$', dest: '/api/part-page?id=$1' },
    { src: '^/$', dest: '/index.html' },
  ],
  images: { domains: [], ...vercelConfig.images },
}));
