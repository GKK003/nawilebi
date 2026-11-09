import { useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowRight, CircleDot, Filter, Grid2X2, Lightbulb, PackageOpen, Search, SlidersHorizontal, X, Zap, Droplets, Settings2, Boxes, CarFront, Layers3 } from 'lucide-react';
import { categoryLabel, CONDITIONS, formatPrice, PART_CATEGORIES, vehicleLabel, yearLabel, type Part, type PartCategory, type PartCondition } from './catalog';
import { PartPhoto, StockPill } from './storefront-ui';

const categoryIcons: Record<PartCategory, ReactNode> = {
  brakes: <CircleDot />, engine: <Settings2 />, suspension: <Layers3 />, lighting: <Lightbulb />,
  filters: <Filter />, fluids: <Droplets />, electrical: <Zap />, body: <CarFront />, other: <Boxes />,
};

const shortcuts: PartCategory[] = ['brakes', 'engine', 'suspension', 'filters', 'lighting', 'fluids'];
const sortOptions = [
  { value: 'featured', label: 'რჩეული' },
  { value: 'newest', label: 'ბოლოს დამატებული' },
  { value: 'price-low', label: 'ფასი ზრდადობით' },
  { value: 'price-high', label: 'ფასი კლებადობით' },
] as const;

interface Filters {
  search: string;
  category: PartCategory | '';
  make: string;
  model: string;
  condition: PartCondition | '';
  inStock: boolean;
}

const initialFilters: Filters = { search: '', category: '', make: '', model: '', condition: '', inStock: false };
const collator = new Intl.Collator('ka-GE', { sensitivity: 'base' });
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ka-GE').replace(/[^\p{L}\p{N}]+/gu, '');

function sortedUnique(values: (string | null)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort(collator.compare);
}

function ProductCard({ part }: { part: Part }) {
  const vehicle = [vehicleLabel(part), yearLabel(part)].filter(Boolean).join(' · ');
  return <a href={`#part/${part.id}`} className="product-card">
    <div className="card-photo">
      <PartPhoto path={part.images[0]?.path} alt={part.images[0]?.alt || part.name} lazy />
      <StockPill quantity={part.quantity} />
    </div>
    <div className="card-content">
      <div className="card-meta"><span>{categoryLabel(part.category)}</span><span>{part.sku}</span></div>
      <h3>{part.name}</h3>
      {vehicle && <p>{vehicle}</p>}
      <div className="card-bottom"><strong className={part.price === null ? 'contact-price' : ''}>{formatPrice(part.price)}</strong><span className="card-arrow" aria-hidden="true"><ArrowRight size={19} /></span></div>
    </div>
  </a>;
}

export default function Storefront({ parts, loading, error, retry, hidden }: {
  parts: Part[]; loading: boolean; error: string; retry: () => void; hidden: boolean;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<typeof sortOptions[number]['value']>('featured');
  const filterDialog = useRef<HTMLDialogElement>(null);
  const makes = sortedUnique(parts.map(({ make }) => make));
  const models = sortedUnique(parts.filter((part) => !filters.make || part.make === filters.make).map(({ model }) => model));
  const filterCount = [filters.category, filters.make, filters.model, filters.condition, filters.inStock].filter(Boolean).length;
  const searchTerms = filters.search.split(/\s+/).map(normalize).filter(Boolean);

  const matches = parts.filter((part) => {
    const searchable = [part.name, part.sku, part.oem_number, part.make, part.model, yearLabel(part), categoryLabel(part.category)]
      .filter(Boolean).map((value) => normalize(value!));
    return (!filters.category || part.category === filters.category)
      && (!filters.make || part.make === filters.make)
      && (!filters.model || part.model === filters.model)
      && (!filters.condition || part.condition === filters.condition)
      && (!filters.inStock || part.quantity > 0)
      && searchTerms.every((term) => searchable.some((value) => value.includes(term)));
  }).sort((a, b) => {
    if (sort === 'price-low' || sort === 'price-high') {
      if (a.price === null) return b.price === null ? 0 : 1;
      if (b.price === null) return -1;
      return sort === 'price-low' ? a.price - b.price : b.price - a.price;
    }
    if (sort === 'featured' && a.is_featured !== b.is_featured) return Number(b.is_featured) - Number(a.is_featured);
    return Date.parse(b.created_at) - Date.parse(a.created_at);
  });

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value, ...(key === 'make' ? { model: '' } : {}) }));
  }

  function selectCategory(category: PartCategory | '') {
    setFilter('category', category);
    if (window.location.hash === '#catalog') document.getElementById('catalog')?.scrollIntoView();
    else window.location.hash = 'catalog';
  }

  const filterFields = <>
    <label className="filter-field">კატეგორია<select value={filters.category} onChange={(event) => setFilter('category', event.target.value as Filters['category'])}>
      <option value="">ყველა კატეგორია</option>
      {PART_CATEGORIES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    <label className="filter-field">ავტომობილის მარკა<select value={filters.make} onChange={(event) => setFilter('make', event.target.value)}>
      <option value="">ყველა მარკა</option>{makes.map((make) => <option key={make}>{make}</option>)}
    </select></label>
    <label className="filter-field">მოდელი<select value={filters.model} onChange={(event) => setFilter('model', event.target.value)}>
      <option value="">ყველა მოდელი</option>{models.map((model) => <option key={model}>{model}</option>)}
    </select></label>
    <label className="filter-field">მდგომარეობა<select value={filters.condition} onChange={(event) => setFilter('condition', event.target.value as Filters['condition'])}>
      <option value="">ნებისმიერი</option>{CONDITIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    <label className="stock-filter"><input type="checkbox" checked={filters.inStock} onChange={(event) => setFilter('inStock', event.target.checked)} /> მხოლოდ მარაგში</label>
  </>;

  return <main id={hidden ? undefined : 'main-content'} tabIndex={-1} className="shell storefront" hidden={hidden}>
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <div className="hero-kicker"><span /> ავტონაწილების კატალოგი</div>
        <h1 id="hero-title">იპოვე საჭირო <span>ავტონაწილი.</span></h1>
        <p>მოძებნე სახელით, მოდელით ან ნაწილის კოდით და გადაამოწმე ფასი და მარაგი.</p>
        <a className="button primary hero-action" href="#catalog">კატალოგის ნახვა <ArrowDown size={17} /></a>
      </div>
    </section>

    <section className="category-section" aria-labelledby="category-title">
      <div className="section-head"><h2 id="category-title">კატეგორიები</h2><button className="text-button" onClick={() => selectCategory('')}>ყველა ნაწილი <ArrowRight size={16} /></button></div>
      <div className="category-grid">
        {shortcuts.map((category) => <button className="category-tile" key={category} aria-pressed={filters.category === category} onClick={() => selectCategory(category)}>
          <span className="category-icon" aria-hidden="true">{categoryIcons[category]}</span><strong>{categoryLabel(category)}</strong>
        </button>)}
      </div>
    </section>

    <section className="catalog-section" id="catalog" aria-labelledby="catalog-title">
      <div className="section-head catalog-heading"><div><h2 id="catalog-title">ნაწილების კატალოგი</h2><p>შეარჩიე ნაწილი შენი ავტომობილისთვის</p></div><span className="catalog-count"><Grid2X2 size={15} /> {parts.length} ნაწილი</span></div>
      <div className="catalog-layout">
        <aside className="filter-panel" aria-label="კატალოგის ფილტრები">
          <div className="filter-title"><strong><SlidersHorizontal size={18} /> ფილტრები</strong>{filterCount > 0 && <button className="text-button" onClick={() => setFilters({ ...initialFilters, search: filters.search })}>გასუფთავება</button>}</div>
          {filterFields}
        </aside>
        <div className="results">
          <div className="results-toolbar">
            <label className="catalog-search"><Search size={19} aria-hidden="true" /><input id="catalog-search" type="search" placeholder="სახელი, კოდი ან ავტომობილი" aria-label="ნაწილის ძებნა" value={filters.search} onChange={(event) => setFilter('search', event.target.value)} /></label>
            <button className="button secondary mobile-filter" onClick={() => filterDialog.current?.showModal()}><SlidersHorizontal size={18} /> ფილტრები{filterCount ? ` (${filterCount})` : ''}</button>
            <label className="sort-field"><span className="sr-only">დალაგება</span><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
              {sortOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select></label>
          </div>
          <div className="result-count" aria-live="polite">{loading ? 'იტვირთება…' : error ? '' : `ნაჩვენებია ${matches.length} ნაწილი`}</div>
          {loading && <div className="product-grid" aria-hidden="true">{[0, 1, 2].map((index) => <div className="skeleton-card" key={index} />)}</div>}
          {error && <div className="empty-state" role="alert"><PackageOpen size={32} /><strong>{error}</strong><button className="button secondary" onClick={retry}>ხელახლა ცდა</button></div>}
          {!loading && !error && matches.length === 0 && <div className="empty-state"><PackageOpen size={32} /><strong>{parts.length ? 'ნაწილი ვერ მოიძებნა' : 'კატალოგი ჯერ ცარიელია'}</strong>{parts.length > 0 && <button className="button secondary" onClick={() => setFilters(initialFilters)}>ფილტრების გასუფთავება</button>}</div>}
          {!loading && !error && matches.length > 0 && <div className="product-grid">{matches.map((part) => <ProductCard part={part} key={part.id} />)}</div>}
        </div>
      </div>
    </section>

    <dialog ref={filterDialog} className="filter-dialog" aria-labelledby="mobile-filter-title">
      <div className="filter-title"><strong id="mobile-filter-title">ფილტრები</strong><button className="icon-button" aria-label="დახურვა" onClick={() => filterDialog.current?.close()}><X size={22} /></button></div>
      {filterFields}
      <div className="dialog-actions"><button className="button secondary" onClick={() => setFilters({ ...initialFilters, search: filters.search })}>გასუფთავება</button><button className="button primary" onClick={() => filterDialog.current?.close()}>ჩვენება ({matches.length})</button></div>
    </dialog>
  </main>;
}
