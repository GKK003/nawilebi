import { useState } from 'react';
import { ArrowUpRight, Mail, MapPin, MessageCircle, PackageOpen, Phone } from 'lucide-react';
import type { Part } from './catalog';
import { stockStatus } from './catalog';
import { imageUrl, type StoreContact } from './repository';

const email: string | undefined = import.meta.env.VITE_STORE_EMAIL?.trim();
const whatsapp: string | undefined = import.meta.env.VITE_STORE_WHATSAPP?.replace(/\D/g, '');
export const hasContact = (contact: StoreContact) => Boolean(contact.phone || contact.address || contact.map_url || email || whatsapp);

export function Brand() {
  return <a className="brand" href="#" aria-label="ნაწილები — მთავარი">
    <img src="/mark.svg" width="42" height="42" alt="" />
    <span><strong>ნაწილები<span>.</span></strong><small>ავტონაწილების კატალოგი</small></span>
  </a>;
}

export function ContactLinks({ contact, part }: { contact: StoreContact; part?: Part }) {
  const { phone, address, map_url } = contact;
  const mapLink = map_url?.startsWith('https://') ? map_url : address
    ? `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query: address })}`
    : null;
  const note = part ? `გამარჯობა, მაინტერესებს ${part.name}.\n${window.location.href}` : 'გამარჯობა, მაინტერესებს ავტონაწილი.';
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
        <a href="#catalog">კატალოგი</a>
        <a href="#admin">ადმინისტრაცია <ArrowUpRight size={15} /></a>
      </div>
    </div>
  </footer>;
}

export function StockPill({ quantity }: { quantity: number }) {
  const status = stockStatus(quantity);
  return <span className={`stock-pill ${status.tone}`}><span aria-hidden="true" />{status.label}</span>;
}

export function PartPhoto({ path, alt, lazy = false }: { path?: string; alt: string; lazy?: boolean }) {
  const src = path ? imageUrl(path) : '';
  const [failedSrc, setFailedSrc] = useState('');
  return src && failedSrc !== src
    ? <img src={src} alt={alt} loading={lazy ? 'lazy' : 'eager'} onError={() => setFailedSrc(src)} />
    : <div className="photo-placeholder" role="img" aria-label="ფოტო მიუწვდომელია"><PackageOpen size={36} strokeWidth={1.4} /></div>;
}
