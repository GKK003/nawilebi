export const PART_CATEGORIES = [
  { value: 'brakes', label: 'მუხრუჭები' },
  { value: 'engine', label: 'ძრავა' },
  { value: 'suspension', label: 'სავალი ნაწილი' },
  { value: 'lighting', label: 'განათება' },
  { value: 'filters', label: 'ფილტრები' },
  { value: 'fluids', label: 'ზეთი და სითხეები' },
  { value: 'electrical', label: 'ელექტროობა' },
  { value: 'body', label: 'ძარის ნაწილები' },
  { value: 'other', label: 'სხვა ნაწილები' },
] as const;

export const CONDITIONS = [
  { value: 'new', label: 'ახალი' },
  { value: 'used', label: 'მეორადი' },
  { value: 'refurbished', label: 'აღდგენილი' },
] as const;

export const MAX_IMAGES = 8;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

export type PartCategory = typeof PART_CATEGORIES[number]['value'];
export type PartCondition = typeof CONDITIONS[number]['value'];

export interface PartImage {
  path: string;
  alt: string;
}

export interface Part {
  id: string;
  sku: string;
  name: string;
  category: PartCategory;
  make: string | null;
  model: string | null;
  year_from: number | null;
  year_to: number | null;
  oem_number: string | null;
  condition: PartCondition;
  price: number | null;
  quantity: number;
  description: string;
  is_published: boolean;
  is_featured: boolean;
  images: PartImage[];
  created_at: string;
  updated_at: string;
}

export type PartInput = Omit<Part, 'created_at' | 'updated_at'>;

const priceFormat = new Intl.NumberFormat('ka-GE', { maximumFractionDigits: 2 });

export function formatPrice(price: number | null) {
  return price === null ? 'ფასი შეთანხმებით' : `${priceFormat.format(price)} ₾`;
}

export function stockStatus(quantity: number): { label: string; tone: 'available' | 'low' | 'out' } {
  if (quantity === 0) return { label: 'ამოწურულია', tone: 'out' };
  if (quantity <= 3) return { label: 'მცირე მარაგი', tone: 'low' };
  return { label: 'მარაგშია', tone: 'available' };
}

export function categoryLabel(category: string) {
  return PART_CATEGORIES.find(({ value }) => value === category)?.label ?? category;
}

export function vehicleLabel(part: Part) {
  return [part.make, part.model].filter(Boolean).join(' ');
}

export function yearLabel({ year_from, year_to }: Part) {
  if (year_from && year_to && year_from !== year_to) return `${year_from}–${year_to}`;
  if (year_from && year_to) return `${year_from}`;
  if (year_from) return `${year_from} წლიდან`;
  if (year_to) return `${year_to} წლამდე`;
  return '';
}
