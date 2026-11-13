import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { formatPrice, partTitle, stockStatus, type Part } from '../src/catalog';
import { partPath, readPartId, storefrontOrigin } from '../src/store-routes';
import { resolveSupabaseProject } from '../src/supabase-config';
import { renderShareMetadata } from './share-metadata';

const template = readFile(new URL('./index.html', import.meta.url), 'utf8');
const project = resolveSupabaseProject({
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
});
const columns = 'name,make,model,year_from,year_to,category,price,quantity,images';
type SharePart = Pick<Part, 'name' | 'make' | 'model' | 'year_from' | 'year_to' | 'category' | 'price' | 'quantity' | 'images'>;

async function readPublishedPart(id: string): Promise<SharePart | undefined> {
  if (!project.url || !project.key) throw new Error('Supabase project is not configured');
  const url = new URL('/rest/v1/parts', project.url);
  url.search = new URLSearchParams({ select: columns, id: `eq.${id}`, is_published: 'eq.true', limit: '1' }).toString();
  const response = await fetch(url, {
    headers: { apikey: project.key },
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
  const parts: SharePart[] = await response.json();
  return parts[0];
}

function previewImage(part: SharePart, title: string) {
  const photo = part.images[0];
  if (!photo || !project.url) return undefined;

  const imagePath = photo.path.split('/').map(encodeURIComponent).join('/');
  const source = new URL(`/storage/v1/object/public/part-images/${imagePath}`, project.url);
  const optimized = new URL('/_vercel/image', storefrontOrigin);
  optimized.search = new URLSearchParams({ url: source.href, w: '1280', q: '75' }).toString();
  return {
    url: source.hostname === 'sqgonwlmvcpiywxnmkcu.supabase.co' ? optimized.href : source.href,
    alt: photo.alt || title,
  };
}

export default async function partPage(request: IncomingMessage, response: ServerResponse) {
  const requestUrl = new URL(request.url ?? '/', storefrontOrigin);
  const id = readPartId(requestUrl.pathname.match(/^\/part\/([^/]+)\/?$/)?.[1] ?? requestUrl.searchParams.get('id'));
  const url = id ? storefrontOrigin + partPath(id) : storefrontOrigin + '/';
  const html = await template;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');

  try {
    const part = id ? await readPublishedPart(id) : undefined;
    if (!part) {
      response.statusCode = 404;
      response.setHeader('Cache-Control', 'no-store');
      return response.end(renderShareMetadata(html, {
        title: 'ნაწილი ვერ მოიძებნა — ნაწილები',
        description: 'სხვა ავტონაწილების სანახავად გადადი კატალოგში.',
        url,
        noindex: true,
      }));
    }

    const title = partTitle(part);
    const description = [formatPrice(part.price), stockStatus(part.quantity).label, part.category].filter(Boolean).join(' · ');
    response.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    response.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=60');
    return response.end(renderShareMetadata(html, { title, description, url, image: previewImage(part, title) }));
  } catch (error) {
    console.error('Part preview lookup failed', error);
    response.statusCode = 503;
    response.setHeader('Cache-Control', 'no-store');
    return response.end(html);
  }
}
