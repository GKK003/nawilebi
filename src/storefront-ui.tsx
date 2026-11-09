import { useState } from 'react';
import { ArrowUpRight, Mail, MessageCircle, PackageOpen, Phone } from 'lucide-react';
import type { Part } from './catalog';
import { stockStatus } from './catalog';
import { imageUrl, isLive } from './repository';

const phone: string | undefined = import.meta.env.VITE_STORE_PHONE?.trim();
const email: string | undefined = import.meta.env.VITE_STORE_EMAIL?.trim();
const whatsapp: string | undefined = import.meta.env.VITE_STORE_WHATSAPP?.replace(/\D/g, '');
export const hasContact = Boolean(phone || email || whatsapp);

export function Brand() {
  return <a className="brand" href="#" aria-label="ნაწილები — მთავარი">
    <img src="/mark.svg" width="42" height="42" alt="" />
    <span><strong>ნაწილები<span>.</span></strong><small>ავტონაწილების კატალოგი</small></span>
  </a>;
}

export function ContactLinks({ part }: { part?: Part }) {
  const note = part ? `გამარჯობა, მაინტერესებს ${part.name} (${part.sku}).\n${window.location.href}` : 'გამარჯობა, მაინტერესებს ავტონაწილი.';
  return <div className="contact-links">
    {whatsapp && <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(note)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={17} /> WhatsApp <ArrowUpRight size={14} /></a>}
    {phone && <a href={`tel:${phone.replace(/[^+\d]/g, '')}`}><Phone size={16} /> {phone}</a>}
    {email && <a href={`mailto:${email}?subject=${encodeURIComponent(part ? part.sku : 'ავტონაწილები')}&body=${encodeURIComponent(note)}`}><Mail size={17} /> ელფოსტა</a>}
  </div>;
}

export function StoreFooter() {
  return <footer className="site-footer" id="contact">
    <div className="shell footer-inner">
      <div><Brand /><p>{isLive ? 'მოძებნე ნაწილი და გადაამოწმე მარაგი.' : 'დემო კატალოგი საილუსტრაციო ავტონაწილებით.'}</p></div>
      <div className="footer-links">
        {hasContact && <ContactLinks />}
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
