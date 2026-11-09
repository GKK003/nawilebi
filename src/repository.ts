import { createClient } from '@supabase/supabase-js';
import { IMAGE_MIME_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES, type Part, type PartImage, type PartInput } from './catalog';
import { DEMO_PARTS } from './demo';
import { demoImageUrl, hydrateDemoImages, putDemoImages, removeDemoImages } from './demo-storage';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const catalogKey = 'nawilebi-catalog-v1';
const sessionKey = 'nawilebi-demo-admin';
const bucket = 'part-images';
const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
const staleMessage = 'ჩანაწერი უკვე შეიცვალა. განაახლე სია და სცადე ხელახლა.';
const demoAdmin = { email: 'დემო ადმინისტრატორი' };

export class PartSaveUnconfirmedError extends Error {
  constructor() {
    super('ნაწილის შენახვა ვერ დადასტურდა. განაახლე სია და გადაამოწმე ჩანაწერი.');
  }
}

export const isLive = Boolean(url || key);

function connect() {
  if (!url || !key) return null;
  try {
    return createClient(url, key, { auth: { detectSessionInUrl: false } });
  } catch {
    return null;
  }
}

const supabase = connect();

function client() {
  if (!supabase) throw new Error('Supabase-ის კავშირი დასაყენებელია.');
  return supabase;
}

function readDemoParts(): Part[] {
  const saved = localStorage.getItem(catalogKey);
  return saved ? JSON.parse(saved) as Part[] : DEMO_PARTS;
}

function requireDemoAdmin() {
  if (sessionStorage.getItem(sessionKey) !== '1') throw new Error('გაგრძელებისთვის შედი ადმინისტრატორის გვერდზე.');
}

async function confirmAdmin(email: string) {
  const { data, error } = await client().rpc('is_catalog_admin');
  if (error) throw new Error('ადმინისტრატორის წვდომა ვერ გადამოწმდა.');
  return data === true ? { email } : null;
}

export async function getAdminSession() {
  if (!isLive) return sessionStorage.getItem(sessionKey) === '1' ? demoAdmin : null;
  const { data: { session }, error } = await client().auth.getSession();
  if (error || !session?.user.email) return null;
  return confirmAdmin(session.user.email);
}

export async function signIn(email: string, password: string) {
  if (!isLive) {
    sessionStorage.setItem(sessionKey, '1');
    return demoAdmin;
  }
  const { data, error } = await client().auth.signInWithPassword({ email, password });
  if (error || !data.user?.email) throw new Error('შესვლა ვერ მოხერხდა. გადაამოწმე ელფოსტა და პაროლი.');
  const admin = await confirmAdmin(data.user.email);
  if (admin) return admin;
  await client().auth.signOut({ scope: 'local' });
  throw new Error('ამ ანგარიშს ადმინისტრატორის წვდომა არ აქვს.');
}

export async function signOut() {
  if (!isLive) {
    sessionStorage.removeItem(sessionKey);
    return;
  }
  const { error } = await client().auth.signOut({ scope: 'local' });
  if (error) throw new Error('გასვლა ვერ მოხერხდა. სცადე ხელახლა.');
}

async function listParts(publishedOnly: boolean) {
  if (!isLive) {
    if (!publishedOnly) requireDemoAdmin();
    const parts = readDemoParts().filter((part) => !publishedOnly || part.is_published);
    await hydrateDemoImages(parts.flatMap(({ images }) => images));
    return parts;
  }

  const parts: Part[] = [];
  let cursor: string | undefined;
  // Keyset pagination avoids Supabase's per-request row cap and offset shifts.
  for (;;) {
    let query = client().from('parts').select('*').order('id').limit(200);
    if (publishedOnly) query = query.eq('is_published', true);
    if (cursor) query = query.gt('id', cursor);
    const { data, error } = await query;
    if (error) throw new Error('კატალოგი ვერ ჩაიტვირთა.');
    if (!data.length) return parts;
    const page = data as Part[];
    parts.push(...page);
    cursor = page.at(-1)?.id;
  }
}

export const listPublicParts = () => listParts(true);
export const listAdminParts = () => listParts(false);

export function imageUrl(path: string) {
  return isLive ? client().storage.from(bucket).getPublicUrl(path).data.publicUrl : demoImageUrl(path);
}

export async function uploadPartImages(partId: string, files: File[]): Promise<PartImage[]> {
  if (!files.length) return [];
  if (files.length > MAX_IMAGES || files.some(({ type, size }) => !IMAGE_MIME_TYPES.includes(type) || size === 0 || size > MAX_IMAGE_BYTES)) {
    throw new Error('ატვირთე მაქსიმუმ 8 ფოტო (JPG, PNG, WebP ან AVIF, თითოეული 8 მბ-მდე).');
  }
  const prefix = isLive ? partId : `demo/${partId}`;
  const images = files.map(({ type }) => ({ path: `${prefix}/${crypto.randomUUID()}.${extensions[type]}`, alt: '' }));
  if (!isLive) {
    requireDemoAdmin();
    await putDemoImages(images, files);
    return images;
  }

  const uploads = await Promise.allSettled(images.map(async ({ path }, index) => {
    const { error } = await client().storage.from(bucket).upload(path, files[index], { cacheControl: '31536000' });
    if (error) throw error;
  }));
  if (uploads.some(({ status }) => status === 'rejected')) {
    await cleanupImages(images);
    throw new Error('ფოტოების ატვირთვა ვერ მოხერხდა. სცადე ხელახლა.');
  }
  return images;
}

export async function discardUploads(images: PartImage[]) {
  if (!images.length) return;
  if (!isLive) {
    requireDemoAdmin();
    const usedPaths = new Set(readDemoParts().flatMap((part) => part.images.map(({ path }) => path)));
    await removeDemoImages(images.map(({ path }) => path).filter((path) => path.startsWith('demo/') && !usedPaths.has(path)));
    return;
  }
  // Storage RLS protects referenced photos, including uploads committed before a dropped response.
  const { error } = await client().storage.from(bucket).remove(images.map(({ path }) => path));
  if (error) throw new Error('დროებითი ფოტოები ვერ წაიშალა.');
}

async function cleanupImages(images: PartImage[]) {
  try {
    await discardUploads(images);
  } catch (error) {
    // The catalog mutation already succeeded. Keep the result and report cleanup separately.
    console.warn('Part image cleanup failed', error);
  }
}

export async function savePart(input: PartInput, expectedUpdatedAt?: string): Promise<Part> {
  if (!isLive) {
    requireDemoAdmin();
    const parts = readDemoParts();
    const existing = parts.find(({ id }) => id === input.id);
    if (existing?.updated_at !== expectedUpdatedAt) throw new Error(staleMessage);
    if (parts.some(({ id, sku }) => id !== input.id && sku.toLowerCase() === input.sku.toLowerCase())) {
      throw new Error('ამ კოდით ნაწილი უკვე არსებობს.');
    }
    const now = new Date(Math.max(Date.now(), existing ? Date.parse(existing.updated_at) + 1 : 0)).toISOString();
    const saved = { ...input, created_at: existing?.created_at ?? now, updated_at: now };
    localStorage.setItem(catalogKey, JSON.stringify([saved, ...parts.filter(({ id }) => id !== input.id)]));
    await cleanupImages(existing?.images.filter(({ path }) => !input.images.some((image) => image.path === path)) ?? []);
    return saved;
  }

  let oldImages: PartImage[] = [];
  if (expectedUpdatedAt) {
    const { data, error } = await client().from('parts').select('images').eq('id', input.id).eq('updated_at', expectedUpdatedAt).maybeSingle();
    if (error) throw new Error('ნაწილის მონაცემები ვერ ჩაიტვირთა.');
    if (!data) throw new Error(staleMessage);
    oldImages = data.images as PartImage[];
  }

  const table = client().from('parts');
  const { id, ...changes } = input;
  const query = expectedUpdatedAt
    ? table.update(changes).eq('id', id).eq('updated_at', expectedUpdatedAt)
    : table.insert(input);
  const { data, error } = await query.select('*').maybeSingle().then((result) => result, () => { throw new PartSaveUnconfirmedError(); });
  if (error?.code === '23505') throw new Error('ამ კოდით ნაწილი უკვე არსებობს.');
  if (error?.code?.startsWith('23') || error?.code === '42501') throw new Error('ნაწილი ვერ შეინახა. გადაამოწმე მონაცემები და წვდომა.');
  if (error) throw new PartSaveUnconfirmedError();
  if (!data) throw new Error(staleMessage);
  await cleanupImages(oldImages.filter(({ path }) => !input.images.some((image) => image.path === path)));
  return data as Part;
}

export async function deletePart(part: Part) {
  if (!isLive) {
    requireDemoAdmin();
    const parts = readDemoParts();
    const existing = parts.find(({ id }) => id === part.id);
    if (existing?.updated_at !== part.updated_at) throw new Error(staleMessage);
    localStorage.setItem(catalogKey, JSON.stringify(parts.filter(({ id }) => id !== part.id)));
  } else {
    const { data, error } = await client().from('parts').delete().eq('id', part.id).eq('updated_at', part.updated_at).select('id').maybeSingle();
    if (error) throw new Error('ნაწილის წაშლა ვერ დადასტურდა. განაახლე სია და გადაამოწმე ჩანაწერი.');
    if (!data) throw new Error(staleMessage);
  }
  await cleanupImages(part.images);
}
