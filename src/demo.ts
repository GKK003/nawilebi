import type { Part, PartInput } from './catalog';

const date = '2026-11-10T00:00:00.000Z';

const defaults = {
  condition: 'new',
  is_published: true,
  is_featured: false,
  year_from: null,
  year_to: null,
  make: null,
  model: null,
  oem_number: null,
} as const;

function demoPart(index: number, item: Omit<PartInput, keyof typeof defaults | 'id' | 'images'> & Partial<Pick<PartInput, keyof typeof defaults>>, photos: string[]): Part {
  return {
    ...defaults,
    ...item,
    id: `8b770000-b74d-4252-8a92-11a40000000${index}`,
    images: photos.map((photo) => ({ path: `/images/${photo}.webp`, alt: item.name })),
    created_at: date,
    updated_at: date,
  };
}

export const DEMO_PARTS: Part[] = [
  demoPart(1, {
    sku: 'BRK-0101', name: 'წინა სამუხრუჭე დისკები', category: 'brakes',
    make: 'BMW', model: '3 Series (F30)', year_from: 2012, year_to: 2019,
    oem_number: '34116864906', price: 240, quantity: 8, is_featured: true,
    description: 'ვენტილირებადი წინა სამუხრუჭე დისკების წყვილი. შეკვეთამდე შეადარე დეტალის კოდი და ზომა შენს ავტომობილზე დამონტაჟებულ ნაწილს.',
  }, ['brake-discs', 'brakes-detail', 'brakes-angle']),
  demoPart(2, {
    sku: 'FLT-0204', name: 'ძრავის ჰაერის ფილტრი', category: 'filters',
    make: 'Toyota', model: 'Camry', year_from: 2018, year_to: 2024,
    oem_number: '17801-0H050', price: 45, quantity: 14, is_featured: true,
    description: 'ძრავის ჰაერის ფილტრი პერიოდული მომსახურებისთვის. თავსებადობა გადაამოწმე ავტომობილის მოდელით და დეტალის კოდით.',
  }, ['air-filter']),
  demoPart(3, {
    sku: 'ENG-0308', name: 'ირიდიუმის სანთლების კომპლექტი', category: 'engine',
    make: 'Honda', model: 'Civic', year_from: 2016, year_to: 2021,
    oem_number: '12290-5BA-A01', price: 120, quantity: 3, is_featured: true,
    description: 'ანთების სანთლების ოთხცალიანი კომპლექტი. გადაამოწმე თავსებადობა ძრავის მოდელის მიხედვით.',
  }, ['spark-plugs']),
  demoPart(4, {
    sku: 'SUS-0412', name: 'უკანა ამორტიზატორები', category: 'suspension',
    make: 'Mercedes-Benz', model: 'C-Class (W205)', year_from: 2014, year_to: 2021,
    price: 280, quantity: 6, description: 'უკანა ამორტიზატორების წყვილი. არჩევისას გადაამოწმე სავალი ნაწილის ტიპი.',
  }, ['shock-absorbers']),
  demoPart(5, {
    sku: 'FLD-0510', name: 'ძრავის ზეთი 5W-30, 4 ლ', category: 'fluids',
    price: 95, quantity: 12, description: 'ოთხლიტრიანი ძრავის ზეთი. გამოყენებამდე შეამოწმე ავტომობილის მწარმოებლის მოთხოვნილი სპეციფიკაცია.',
  }, ['engine-oil']),
  demoPart(6, {
    sku: 'LGT-0602', name: 'მარცხენა წინა ფარი', category: 'lighting',
    make: 'Volkswagen', model: 'Golf VII', year_from: 2013, year_to: 2017,
    condition: 'used', price: 360, quantity: 0,
    description: 'მეორადი მარცხენა წინა ფარი. შეკვეთამდე შეადარე კონექტორი და სამაგრების განლაგება.',
  }, ['headlight']),
];
