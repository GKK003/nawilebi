import type { PartImage } from './catalog';

const previewUrls = new Map<string, string>();
let database: Promise<IDBDatabase> | undefined;

function openDatabase() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('nawilebi-demo-photos', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('photos');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('ფოტოების საცავი ვერ გაიხსნა.'));
  });
  return database;
}

export function demoImageUrl(path: string) {
  return path.startsWith('/') ? path : previewUrls.get(path) ?? '';
}

export async function hydrateDemoImages(images: PartImage[]) {
  const paths = new Set(images.map(({ path }) => path).filter((path) => path.startsWith('demo/') && !previewUrls.has(path)));
  if (!paths.size) return;
  const db = await openDatabase();
  const store = db.transaction('photos').objectStore('photos');
  await Promise.all([...paths].map((path) => new Promise<void>((resolve, reject) => {
    const request = store.get(path);
    request.onsuccess = () => {
      if (request.result instanceof Blob && !previewUrls.has(path)) previewUrls.set(path, URL.createObjectURL(request.result));
      resolve();
    };
    request.onerror = () => reject(new Error('ფოტოები ვერ ჩაიტვირთა.'));
  })));
}

export async function putDemoImages(images: PartImage[], files: File[]) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('photos', 'readwrite');
    const store = transaction.objectStore('photos');
    images.forEach(({ path }, index) => store.put(files[index], path));
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(new Error('ფოტოებისთვის თავისუფალი ადგილი ვერ მოიძებნა.'));
  });
  images.forEach(({ path }, index) => previewUrls.set(path, URL.createObjectURL(files[index])));
}

export async function removeDemoImages(paths: string[]) {
  if (!paths.length) return;
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('photos', 'readwrite');
    const store = transaction.objectStore('photos');
    paths.forEach((path) => store.delete(path));
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(new Error('ფოტოები ვერ წაიშალა.'));
  });
  paths.forEach((path) => {
    const url = previewUrls.get(path);
    if (url) URL.revokeObjectURL(url);
    previewUrls.delete(path);
  });
}
