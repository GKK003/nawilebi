export const storefrontOrigin = 'https://nawilebi.vercel.app';

const partIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function partPath(id: string) {
  return `/part/${id}`;
}

export function readPartId(value: string | null) {
  return value && partIdPattern.test(value) ? value.toLowerCase() : '';
}
