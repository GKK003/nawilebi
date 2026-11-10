import { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { ArrowUpRight, Search } from 'lucide-react';
import '@fontsource-variable/inter';
import '@fontsource-variable/noto-sans-georgian';
import './styles.css';
import { partTitle, type Part } from './catalog';
import PartDetail from './PartDetail';
import { defaultStoreContact, listPublicParts, readStoreContact } from './repository';
import Storefront from './Storefront';
import { Brand, StoreFooter } from './storefront-ui';

const Admin = lazy(() => import('./Admin'));

function App() {
  const [hash, setHash] = useState(window.location.hash);
  const [parts, setParts] = useState<Part[]>([]);
  const [contact, setContact] = useState(defaultStoreContact);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const contactSettings = hash === '#admin/contact';
  const adminPage = hash === '#admin' || contactSettings;
  const detailId = hash.startsWith('#part/') ? hash.slice(6) : '';
  const part = parts.find(({ id }) => id === detailId);

  useEffect(() => {
    const update = () => setHash(window.location.hash);
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  useEffect(() => {
    if (adminPage) return;
    let current = true;
    setLoading(true);
    setError('');
    readStoreContact().then((details) => { if (current) setContact(details); }).catch(() => {});
    listPublicParts().then((items) => { if (current) setParts(items); })
      .catch((failure: unknown) => { if (current) setError(failure instanceof Error ? failure.message : 'კატალოგი ვერ ჩაიტვირთა.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [adminPage, revision]);

  useEffect(() => {
    document.title = adminPage ? 'ადმინისტრაცია — ნაწილები' : part ? `${partTitle(part)} — ნაწილები` : 'ნაწილები — ავტონაწილების კატალოგი';
  }, [adminPage, part]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const target = hash === '#catalog' ? document.getElementById('catalog') : null;
      if (target) target.scrollIntoView();
      else window.scrollTo(0, 0);
    });
    return () => cancelAnimationFrame(frame);
  }, [hash]);

  function focusSearch() {
    if (detailId || window.location.hash !== '#catalog') window.location.hash = 'catalog';
    const search = document.getElementById('catalog-search');
    requestAnimationFrame(() => {
      search?.focus({ preventScroll: true });
      search?.scrollIntoView({ block: 'center' });
      if (document.activeElement !== search) requestAnimationFrame(() => search?.focus({ preventScroll: true }));
    });
  }

  if (adminPage) return <Suspense fallback={<div className="shell loading-page" role="status">იტვირთება…</div>}><Admin showContact={contactSettings} /></Suspense>;

  const retry = () => setRevision((version) => version + 1);
  const catalogPath = detailId ? null : '/';
  return <>
    {import.meta.env.PROD && <Analytics
      configString={import.meta.env.VERCEL_OBSERVABILITY_CLIENT_CONFIG}
      route={part ? '/part/[id]' : catalogPath}
      path={part ? `/part/${part.id}` : catalogPath}
    />}
    <a className="skip-link" href="#main-content" onClick={(event) => {
      const target = document.getElementById('main-content');
      if (target) {
        event.preventDefault();
        target.focus();
        target.scrollIntoView();
      }
    }}>გადასვლა შინაარსზე</a>
    <header className="site-header">
      <div className="shell nav-inner">
        <Brand />
        <nav className="nav-links" aria-label="მთავარი ნავიგაცია"><a className={!detailId && hash !== '#catalog' ? 'active' : ''} href="#">მთავარი</a><a className={hash === '#catalog' || detailId ? 'active' : ''} href="#catalog">კატალოგი</a></nav>
        <div className="nav-actions"><button className="icon-button nav-search" aria-label="ნაწილის ძებნა" onClick={focusSearch}><Search size={20} /></button><a className="admin-link" href="#admin" aria-label="ადმინისტრაცია"><span>ადმინისტრაცია</span><ArrowUpRight size={17} /></a></div>
      </div>
    </header>
    <Storefront parts={parts} loading={loading} error={error} retry={retry} hidden={Boolean(detailId)} />
    {detailId && <PartDetail key={detailId} contact={contact} part={part} loading={loading} error={error} retry={retry} />}
    <StoreFooter />
  </>;
}

createRoot(document.getElementById('root')!).render(<App />);
