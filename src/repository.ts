import { createClient } from '@supabase/supabase-js';
import { IMAGE_MIME_TYPES, MAX_IMAGE_BYTES, MAX_IMAGE_MB, MAX_IMAGES, type Part, type PartImage, type PartInput } from './catalog';
import { supabaseProject } from './supabase-project';

const { url, key } = supabaseProject;
const bucket = 'part-images';
const uploadChunkBytes = 6 * 1024 * 1024;
const imageCacheSeconds = '31536000';
const partColumns = 'id,name,category,make,model,year_from,year_to,oem_number,condition,price,quantity,description,is_published,is_featured,images,created_at,updated_at';
const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
const staleMessage = 'ჩანაწერი უკვე შეიცვალა. განაახლე სია და სცადე ხელახლა.';

export interface StoreContact {
  phone: string | null;
  address: string | null;
  map_url: string | null;
}

export const defaultStoreContact: StoreContact = {
  phone: import.meta.env.VITE_STORE_PHONE?.trim() || null,
  address: null,
  map_url: null,
};

export class PartSaveUnconfirmedError extends Error {
  constructor() {
    super('ნაწილის შენახვა ვერ დადასტურდა. განაახლე სია და გადაამოწმე ჩანაწერი.');
  }
}

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

export async function readStoreContact(): Promise<StoreContact> {
  const { data, error } = await client().from('store_contact').select('phone,address,map_url').eq('id', true).maybeSingle();
  if (error?.code === 'PGRST205' || error?.code === '42P01') {
    throw new Error('Supabase-ში საკონტაქტო მონაცემების მიგრაციაა გასაშვები.');
  }
  if (error) throw new Error('საკონტაქტო მონაცემები ვერ ჩაიტვირთა.');
  return data ?? defaultStoreContact;
}

export async function saveStoreContact(contact: StoreContact) {
  const { error } = await client().from('store_contact').upsert({ id: true, ...contact });
  if (error) throw new Error('საკონტაქტო მონაცემები ვერ შეინახა. სცადე ხელახლა.');
}

async function confirmAdmin(email: string) {
  const { data, error } = await client().rpc('is_catalog_admin');
  if (error) throw new Error('ადმინისტრატორის წვდომა ვერ გადამოწმდა.');
  return data === true ? { email } : null;
}

export async function getAdminSession() {
  const { data: { session }, error } = await client().auth.getSession();
  if (error || !session?.user.email) return null;
  return confirmAdmin(session.user.email);
}

export async function signIn(email: string, password: string) {
  const { data, error } = await client().auth.signInWithPassword({ email, password });
  if (error || !data.user?.email) throw new Error('შესვლა ვერ მოხერხდა. გადაამოწმე ელფოსტა და პაროლი.');
  const admin = await confirmAdmin(data.user.email);
  if (admin) return admin;
  await client().auth.signOut({ scope: 'local' });
  throw new Error('ამ ანგარიშს ადმინისტრატორის წვდომა არ აქვს.');
}

export async function signOut() {
  const { error } = await client().auth.signOut({ scope: 'local' });
  if (error) throw new Error('გასვლა ვერ მოხერხდა. სცადე ხელახლა.');
}

async function listParts(publishedOnly: boolean) {
  const parts: Part[] = [];
  let cursor: string | undefined;
  // Keyset pagination avoids Supabase's per-request row cap and offset shifts.
  for (;;) {
    let query = client().from('parts').select(partColumns).order('id').limit(200);
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

function getAnonymousBrowserId() {
  const storageKey = 'nawilebi-viewer-id';
  try {
    const existing = localStorage.getItem(storageKey);
    if (existing && /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(existing)) return existing;

    const id = crypto.randomUUID();
    localStorage.setItem(storageKey, id);
    return id;
  } catch {
    return null;
  }
}

export async function recordPartView(partId: string): Promise<number | null> {
  const { data, error } = await client().rpc('record_part_view', {
    target_part_id: partId,
    browser_id: getAnonymousBrowserId(),
  });
  return !error && typeof data === 'number' ? data : null;
}

export async function listPartViewerCounts(): Promise<Record<string, number> | null> {
  const { data, error } = await client().rpc('list_part_viewer_counts');
  return error ? null : data;
}

export function imageUrl(path: string) {
  return client().storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

async function uploadLargeImage(path: string, file: File) {
  const { Upload } = await import('tus-js-client');
  const endpoint = new URL('/storage/v1/upload/resumable', url);
  if (/^[a-z0-9-]+\.supabase\.co$/.test(endpoint.hostname)) {
    endpoint.hostname = endpoint.hostname.replace(/\.supabase\.co$/, '.storage.supabase.co');
  }

  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: endpoint.href,
      chunkSize: uploadChunkBytes,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      uploadDataDuringCreation: true,
      storeFingerprintForResuming: false,
      metadata: { bucketName: bucket, objectName: path, contentType: file.type, cacheControl: imageCacheSeconds },
      async onBeforeRequest(request) {
        const { data: { session } } = await client().auth.getSession();
        if (!session) throw new Error('ფოტოების ასატვირთად ხელახლა შედი ანგარიშში.');
        request.setHeader('Authorization', `Bearer ${session.access_token}`);
        if (key) request.setHeader('apikey', key);
      },
      onError: reject,
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}

export async function uploadPartImages(partId: string, files: File[]): Promise<PartImage[]> {
  if (!files.length) return [];
  if (files.length > MAX_IMAGES || files.some(({ type, size }) => !IMAGE_MIME_TYPES.includes(type) || size === 0 || size > MAX_IMAGE_BYTES)) {
    throw new Error(`ატვირთე მაქსიმუმ ${MAX_IMAGES} ფოტო (JPG, PNG, WebP ან AVIF, თითოეული ${MAX_IMAGE_MB} მბ-მდე).`);
  }
  const images = files.map(({ type }) => ({ path: `${partId}/${crypto.randomUUID()}.${extensions[type]}`, alt: '' }));

  const uploads = await Promise.allSettled(images.map(async ({ path }, index) => {
    const file = files[index];
    if (file.size > uploadChunkBytes) return uploadLargeImage(path, file);
    const { error } = await client().storage.from(bucket).upload(path, file, { cacheControl: imageCacheSeconds });
    if (error) throw error;
  }));
  const failures = uploads.filter((result) => result.status === 'rejected');
  if (failures.length) {
    await cleanupImages(images);
    const exceedsStorageLimit = failures.some(({ reason }) =>
      Number(reason?.statusCode ?? reason?.originalResponse?.getStatus()) === 413,
    );
    if (exceedsStorageLimit) throw new Error(`Supabase-ის საცავში თითო ფაილის ლიმიტი ${MAX_IMAGE_MB} მბ-მდე გაზარდე.`);
    throw new Error('ფოტოების ატვირთვა ვერ მოხერხდა. სცადე ხელახლა.');
  }
  return images;
}

export async function discardUploads(images: PartImage[]) {
  if (!images.length) return;
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
  const { data, error } = await query.select(partColumns).maybeSingle().then((result) => result, () => { throw new PartSaveUnconfirmedError(); });
  if (error?.code === '23502' && error.message.includes('sku')) throw new Error('Supabase-ში კატალოგის მიგრაციაა გასაშვები.');
  if (error?.code?.startsWith('23') || error?.code === '42501') throw new Error('ნაწილი ვერ შეინახა. გადაამოწმე მონაცემები და წვდომა.');
  if (error) throw new PartSaveUnconfirmedError();
  if (!data) throw new Error(staleMessage);
  await cleanupImages(oldImages.filter(({ path }) => !input.images.some((image) => image.path === path)));
  return data as Part;
}

export async function deletePart(part: Part) {
  const { data, error } = await client().from('parts').delete().eq('id', part.id).eq('updated_at', part.updated_at).select('id').maybeSingle();
  if (error) throw new Error('ნაწილის წაშლა ვერ დადასტურდა. განაახლე სია და გადაამოწმე ჩანაწერი.');
  if (!data) throw new Error(staleMessage);
  await cleanupImages(part.images);
}
