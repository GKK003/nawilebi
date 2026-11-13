import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { formatServicePrice, type MechanicService } from './catalog';
import { deleteService, listServices, saveService } from './repository';

export default function AdminServices() {
  const [services, setServices] = useState<MechanicService[] | null>(null);
  const [editing, setEditing] = useState<{ service: MechanicService | null } | null>(null);
  const [priceType, setPriceType] = useState('fixed');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    listServices(false).then((items) => {
      if (current) setServices(items);
    }).catch((failure: unknown) => {
      if (current) setError(failure instanceof Error ? failure.message : 'მომსახურებები ვერ ჩაიტვირთა.');
    });
    return () => { current = false; };
  }, [attempt]);

  function openEditor(service: MechanicService | null) {
    setError('');
    setPriceType(service?.price === null ? 'quote' : service?.price_from ? 'from' : 'fixed');
    setEditing({ service });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || pending) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const description = String(form.get('description') ?? '').trim();
    const rawPrice = String(form.get('price') ?? '');
    const price = priceType === 'quote' ? null : Number(rawPrice);
    if (!name || (price !== null && (!rawPrice || !Number.isFinite(price) || price < 0 || price > 99999999.99))) {
      setError('მიუთითე მომსახურების სახელი და სწორი ფასი.');
      return;
    }

    setError('');
    setPending(true);
    try {
      const saved = await saveService({ name, description, price, price_from: priceType === 'from', is_published: form.has('is_published') }, editing.service);
      setServices((items) => editing.service ? (items ?? []).map((item) => item.id === saved.id ? saved : item) : [saved, ...(items ?? [])]);
      setEditing(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'მომსახურება ვერ შეინახა.');
    } finally {
      setPending(false);
    }
  }

  async function remove(service: MechanicService) {
    if (pending || !window.confirm(`წაიშალოს „${service.name}“?`)) return;
    setError('');
    setPending(true);
    try {
      await deleteService(service);
      setServices((items) => (items ?? []).filter((item) => item.id !== service.id));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'მომსახურება ვერ წაიშალა.');
    } finally {
      setPending(false);
    }
  }

  function reload() {
    setError('');
    setServices(null);
    setAttempt((value) => value + 1);
  }

  const service = editing?.service;
  return <>
    <a className="inventory-breadcrumb" href="#admin"><ArrowLeft size={16} /> ინვენტარი</a>
    <div className="inventory-page-heading">
      <h1>{editing ? (service ? 'მომსახურების რედაქტირება' : 'ახალი მომსახურება') : 'ავტოსერვისის მართვა'}</h1>
      {services && !editing && <button className="inventory-button is-primary" onClick={() => openEditor(null)} disabled={pending}><Plus size={18} /> მომსახურების დამატება</button>}
    </div>
    {error && <div className="inventory-feedback" role="alert">{error}</div>}
    {editing ? <form className="inventory-card inventory-form-card inventory-contact-form" onSubmit={submit}>
      <label className="inventory-field"><span>მომსახურების სახელი</span><input name="name" defaultValue={service?.name} placeholder="მაგ. ძრავის შეცვლა" maxLength={160} required disabled={pending} /></label>
      <label className="inventory-field"><span>აღწერა</span><textarea name="description" defaultValue={service?.description} rows={4} maxLength={2000} disabled={pending} /></label>
      <div className="inventory-field-grid">
        <label className="inventory-field"><span>ფასის ტიპი</span><select value={priceType} onChange={(event) => setPriceType(event.target.value)} disabled={pending}>
          <option value="fixed">ფიქსირებული</option><option value="from">საწყისი ფასი</option><option value="quote">შეთანხმებით</option>
        </select></label>
        <label className="inventory-field" hidden={priceType === 'quote'}><span>ფასი (₾)</span><input name="price" type="number" min={0} max={99999999.99} step="0.01" defaultValue={service?.price ?? ''} required={priceType !== 'quote'} disabled={pending || priceType === 'quote'} /></label>
      </div>
      <label className="inventory-check"><input name="is_published" type="checkbox" defaultChecked={service?.is_published ?? true} disabled={pending} /><span><strong>გამოქვეყნება</strong><small>მომსახურება გამოჩნდება ავტოსერვისის გვერდზე.</small></span></label>
      <div className="inventory-editor-actions">
        <button className="inventory-button is-primary" type="submit" disabled={pending}>{pending ? 'ინახება…' : 'შენახვა'}</button>
        <button className="inventory-button" type="button" disabled={pending} onClick={() => { setError(''); setEditing(null); }}>გაუქმება</button>
      </div>
    </form> : services === null ? (error ? <button className="inventory-button" onClick={reload}>ხელახლა ჩატვირთვა</button> : <p role="status">იტვირთება…</p>)
      : services.length === 0 ? <div className="inventory-card inventory-empty"><h2>მომსახურებები ჯერ არ დამატებულა</h2></div>
      : <ul className="inventory-card inventory-services">{services.map((item) => <li key={item.id}>
        <div><strong>{item.name}</strong><div className="inventory-subtitle">{formatServicePrice(item)}</div></div>
        <span className={`inventory-badge ${item.is_published ? 'is-published' : ''}`}>{item.is_published ? 'გამოქვეყნებული' : 'დამალული'}</span>
        <div className="inventory-row-actions">
          <button className="inventory-icon-btn" aria-label={`${item.name} · რედაქტირება`} disabled={pending} onClick={() => openEditor(item)}><Pencil size={17} /></button>
          <button className="inventory-icon-btn is-danger" aria-label={`${item.name} · წაშლა`} disabled={pending} onClick={() => void remove(item)}><Trash2 size={17} /></button>
        </div>
      </li>)}</ul>}
  </>;
}
