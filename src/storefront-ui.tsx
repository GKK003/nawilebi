import { useState } from 'react';
import { ArrowUpRight, Mail, MapPin, MessageCircle, PackageOpen, Phone } from 'lucide-react';
import type { Part } from './catalog';
import { stockStatus } from './catalog';
import { imageUrl, type StoreContact } from './repository';
import { partPath } from './store-routes';
import StoreLink from './StoreLink';

const email: string | undefined = import.meta.env.VITE_STORE_EMAIL?.trim();
const whatsapp: string | undefined = import.meta.env.VITE_STORE_WHATSAPP?.replace(/\D/g, '');
export const hasContact = (contact: StoreContact) => Boolean(contact.phone || contact.address || contact.map_url || email || whatsapp);

export function Brand() {
  return <StoreLink className="brand" href="/" aria-label="ნაწილები — მთავარი">
    <img src="/mark.svg" width="42" height="42" alt="" />
    <span><strong>ნაწილები<span>.</span></strong><small>ავტონაწილების კატალოგი</small></span>
  </StoreLink>;
}

export function ContactLinks({ contact, part }: { contact: StoreContact; part?: Part }) {
  const { phone, address, map_url } = contact;
  const mapLink = map_url?.startsWith('https://') ? map_url : address
    ? `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query: address })}`
    : null;
  const note = part ? `გამარჯობა, მაინტერესებს ${part.name}.\n${new URL(partPath(part.id), window.location.origin).href}` : 'გამარჯობა, მაინტერესებს ავტონაწილი.';
  return <div className="contact-links">
    {whatsapp && <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(note)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={17} /> WhatsApp <ArrowUpRight size={14} /></a>}
    {phone && <a href={`tel:${phone.replace(/[^+\d]/g, '')}`}><Phone size={16} /> {phone}</a>}
    {mapLink && <a href={mapLink} target="_blank" rel="noopener noreferrer"><MapPin size={17} /><span>{address || 'რუკაზე ნახვა'}</span><ArrowUpRight size={14} /></a>}
    {email && <a href={`mailto:${email}?subject=${encodeURIComponent(part?.name ?? 'ავტონაწილები')}&body=${encodeURIComponent(note)}`}><Mail size={17} /> ელფოსტა</a>}
  </div>;
}

export function StoreFooter() {
  return <footer className="site-footer">
    <div className="shell footer-inner">
      <div><Brand /><p>მოძებნე ნაწილი და გადაამოწმე მარაგი.</p></div>
      <div className="footer-links">
        <StoreLink href="/#catalog">კატალოგი</StoreLink>
        <StoreLink href="/#services">ავტოსერვისი</StoreLink>
        <StoreLink href="/#admin">ადმინისტრაცია <ArrowUpRight size={15} /></StoreLink>
      </div>
    </div>
  </footer>;
}

export function StockPill({ quantity }: { quantity: number }) {
  const status = stockStatus(quantity);
  return <span className={`stock-pill ${status.tone}`}><span aria-hidden="true" />{status.label}</span>;
}

const photoLayouts = {
  thumbnail: { widths: [96, 160], sizes: '74px' },
  card: {
    widths: [320, 480, 640, 960],
    sizes: '(max-width: 350px) calc(100vw - 32px), (max-width: 570px) calc((100vw - 42px) / 2), (max-width: 820px) calc((100vw - 72px) / 3), (max-width: 1070px) calc((100vw - 285px) / 3), (max-width: 1360px) calc((100vw - 360px) / 3), 332px',
  },
  gallery: {
    widths: [480, 640, 960, 1280],
    sizes: '(max-width: 570px) calc(100vw - 32px), (max-width: 1070px) calc(53vw - 40px), (max-width: 1360px) calc(53vw - 57px), 662px',
  },
};

function optimizedPhotoUrl(source: string, width: number) {
  return `/_vercel/image?${new URLSearchParams({ url: source, w: String(width), q: '75' })}`;
}

export function PartPhoto({ path, alt, variant }: { path?: string; alt: string; variant: keyof typeof photoLayouts }) {
  const src = path ? imageUrl(path) : '';
  const [failedSrc, setFailedSrc] = useState('');
  const [failedOptimization, setFailedOptimization] = useState('');
  if (!src || failedSrc === src) return <div className="photo-placeholder" role="img" aria-label="ფოტო მიუწვდომელია"><PackageOpen size={36} strokeWidth={1.4} /></div>;

  const { widths, sizes } = photoLayouts[variant];
  const useOptimizer = import.meta.env.VERCEL && failedOptimization !== src
    && src.startsWith('https://sqgonwlmvcpiywxnmkcu.supabase.co/storage/v1/object/public/part-images/');
  const displaySrc = useOptimizer ? optimizedPhotoUrl(src, widths[0]) : src;
  const mainPhoto = variant === 'gallery';

  return <img
    key={displaySrc}
    src={displaySrc}
    srcSet={useOptimizer ? widths.map((width) => `${optimizedPhotoUrl(src, width)} ${width}w`).join(', ') : undefined}
    sizes={useOptimizer ? sizes : undefined}
    alt={alt}
    loading={mainPhoto ? 'eager' : 'lazy'}
    fetchPriority={mainPhoto ? 'high' : undefined}
    decoding="async"
    onError={() => useOptimizer ? setFailedOptimization(src) : setFailedSrc(src)}
  />;
}
