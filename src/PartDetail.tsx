import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, Eye, Link2, Package, PackageOpen } from 'lucide-react';
import { CONDITIONS, formatPrice, partTitle, vehicleLabel, yearLabel, type Part } from './catalog';
import { ContactLinks, hasContact, PartPhoto, StockPill } from './storefront-ui';
import { recordPartView, type StoreContact } from './repository';

const viewerFormatter = new Intl.NumberFormat('ka-GE');

export default function PartDetail({ contact, part, loading, error, retry }: { contact: StoreContact; part?: Part; loading: boolean; error: string; retry: () => void }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'manual'>('idle');
  const [viewers, setViewers] = useState<number | null>(null);
  const publishedPartId = part?.is_published && !loading && !error ? part.id : null;

  useEffect(() => {
    if (!publishedPartId) return;
    let current = true;
    recordPartView(publishedPartId).then((count) => {
      if (current) setViewers(count);
    }).catch(() => {});
    return () => { current = false; };
  }, [publishedPartId]);

  async function copyPartLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('manual');
    }
  }

  if (!part || loading || error) return <main id="main-content" tabIndex={-1} className="shell detail-page">
    <a className="back-link" href="#catalog"><ArrowLeft size={17} /> კატალოგში დაბრუნება</a>
    <div className="empty-state" role={error ? 'alert' : undefined}><PackageOpen size={34} /><strong>{loading ? 'იტვირთება…' : error || 'ნაწილი ვერ მოიძებნა'}</strong>{error && <button className="button secondary" onClick={retry}>ხელახლა ცდა</button>}</div>
  </main>;

  const photos = part.images;
  const index = Math.min(photoIndex, Math.max(photos.length - 1, 0));
  const activePhoto = photos[index];
  const movePhoto = (direction: number) => setPhotoIndex((index + direction + photos.length) % photos.length);
  const specifications = [
    ['კატეგორია', part.category],
    ['ავტომობილი', vehicleLabel(part)],
    ['გამოშვების წელი', yearLabel(part)],
    ['მდგომარეობა', CONDITIONS.find(({ value }) => value === part.condition)?.label],
    ['OEM კოდი', part.oem_number],
  ].filter(([, value]) => value);

  return <main id="main-content" tabIndex={-1} className="shell detail-page">
    <nav className="breadcrumbs" aria-label="გვერდის მდებარეობა"><a href="#catalog">კატალოგი</a><ChevronRight size={14} /><span>{part.category}</span><ChevronRight size={14} /><span aria-current="page">{part.name}</span></nav>
    <div className="detail-grid">
      <section className="gallery" aria-label="ნაწილის ფოტოები">
        <div className="gallery-main">
          <PartPhoto path={activePhoto?.path} alt={activePhoto?.alt || part.name} variant="gallery" />
          {photos.length > 1 && <div className="gallery-controls"><button className="icon-button" type="button" aria-label="წინა ფოტო" onClick={() => movePhoto(-1)}><ArrowLeft size={19} /></button><span>{index + 1} / {photos.length}</span><button className="icon-button" type="button" aria-label="შემდეგი ფოტო" onClick={() => movePhoto(1)}><ArrowRight size={19} /></button></div>}
        </div>
        {photos.length > 1 && <div className="thumbnails">{photos.map(({ path }, photo) => <button key={path} type="button" aria-label={`ფოტო ${photo + 1}`} aria-pressed={photo === index} onClick={() => setPhotoIndex(photo)}><PartPhoto path={path} alt="" variant="thumbnail" /></button>)}</div>}
      </section>
      <section className="detail-info" aria-labelledby="part-title">
        <div className="detail-meta">
          <StockPill quantity={part.quantity} />
          {viewers !== null && <span className="part-viewers"><Eye size={15} aria-hidden="true" /> {viewerFormatter.format(viewers)} მნახველი</span>}
        </div>
        <h1 id="part-title">{partTitle(part)}</h1>
        <div className="detail-price"><strong>{formatPrice(part.price)}</strong><span><Package size={17} /> მარაგი: {part.quantity} ც.</span></div>
        {part.description && <p className="description">{part.description}</p>}
        <dl className="specifications">{specifications.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <div className="detail-actions">
          {hasContact(contact) && <ContactLinks contact={contact} part={part} />}
          <button className="button secondary" type="button" onClick={copyPartLink}><Link2 size={17} /> ბმულის კოპირება</button>
        </div>
        <span className="copy-feedback" role="status">{copyStatus === 'copied' && 'ბმული დაკოპირდა'}</span>
        {copyStatus === 'manual' && <label className="filter-field">დააკოპირე ნაწილის ბმული<input readOnly value={window.location.href} onFocus={(event) => event.target.select()} /></label>}
      </section>
    </div>
  </main>;
}
