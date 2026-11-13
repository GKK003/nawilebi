import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ImagePlus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { formatServicePrice, IMAGE_MIME_TYPES, MAX_IMAGE_BYTES, MAX_IMAGE_MB, MAX_IMAGES, type MechanicService, type PartImage } from './catalog';
import { deleteService, listServices, saveService } from './repository';
import { PartPhoto } from './storefront-ui';

type DraftPhoto = PartImage | { file: File; preview: string };

export default function AdminServices() {
  const [services, setServices] = useState<MechanicService[] | null>(null);
  const [editing, setEditing] = useState<{ service: MechanicService | null; id: string } | null>(null);
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [photoError, setPhotoError] = useState('');
  const previewUrls = useRef(new Set<string>());
  const [priceType, setPriceType] = useState('fixed');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const urls = previewUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

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
    setPhotoError('');
    setPhotos(service?.images ?? []);
    setPriceType(service?.price === null ? 'quote' : service?.price_from ? 'from' : 'fixed');
    setEditing({ service, id: service?.id ?? crypto.randomUUID() });
  }

  function closeEditor() {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
    setPhotos([]);
    setEditing(null);
  }

  function addPhotos(files: FileList) {
    const selected = Array.from(files);
    if (photos.length + selected.length > MAX_IMAGES) {
      setPhotoError(`მაქსიმუმ ${MAX_IMAGES} ფოტოს დამატება შეგიძლია.`);
      return;
    }
    if (selected.some(({ type, size }) => !IMAGE_MIME_TYPES.includes(type) || size === 0 || size > MAX_IMAGE_BYTES)) {
      setPhotoError(`აირჩიე JPG, PNG, WebP ან AVIF ფოტო, მაქსიმუმ ${MAX_IMAGE_MB} მბ თითო ფაილზე.`);
      return;
    }
    setPhotoError('');
    const added = selected.map((file) => {
      const preview = URL.createObjectURL(file);
      previewUrls.current.add(preview);
      return { file, preview };
    });
    setPhotos([...photos, ...added]);
  }

  function removePhoto(photo: DraftPhoto) {
    if ('preview' in photo && previewUrls.current.delete(photo.preview)) URL.revokeObjectURL(photo.preview);
    setPhotoError('');
    setPhotos((items) => items.filter((item) => item !== photo));
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
      const saved = await saveService({ name, description, price, price_from: priceType === 'from', is_published: form.has('is_published') }, editing.service, editing.id, photos.map((photo) => 'file' in photo ? photo.file : photo));
      setServices((items) => editing.service ? (items ?? []).map((item) => item.id === saved.id ? saved : item) : [saved, ...(items ?? [])]);
      closeEditor();
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
      <section aria-labelledby="service-photos-title">
        <div className="inventory-photo-heading">
          <h2 id="service-photos-title">ფოტოები</h2>
          <span className="inventory-photo-count">{photos.length} / {MAX_IMAGES}</span>
        </div>
        {photos.length > 0 && <div className="inventory-photo-grid">
          {photos.map((photo, index) => <div className="inventory-photo" key={'path' in photo ? photo.path : photo.preview}>
            <div className="inventory-photo-preview">
              {'path' in photo ? <PartPhoto path={photo.path} alt={photo.alt} variant="card" />
                : <img src={photo.preview} alt="" loading="lazy" decoding="async" />}
            </div>
            <div className="inventory-photo-controls">
              <button className="inventory-icon-btn is-danger" type="button" disabled={pending} onClick={() => removePhoto(photo)} aria-label={`ფოტო ${index + 1} · წაშლა`}><X size={17} /></button>
            </div>
          </div>)}
        </div>}
        {photoError && <div className="inventory-feedback" role="alert">{photoError}</div>}
        {photos.length < MAX_IMAGES && <label className="inventory-dropzone">
          <input className="inventory-sr-only" type="file" accept={IMAGE_MIME_TYPES.join(',')} multiple disabled={pending} onChange={(event) => {
            if (event.currentTarget.files) addPhotos(event.currentTarget.files);
            event.currentTarget.value = '';
          }} />
          <ImagePlus size={24} /><strong>აირჩიე ფოტოები</strong><span>JPG, PNG, WebP ან AVIF · თითოეული მაქს. {MAX_IMAGE_MB} მბ</span>
        </label>}
      </section>
      <label className="inventory-check"><input name="is_published" type="checkbox" defaultChecked={service?.is_published ?? true} disabled={pending} /><span><strong>გამოქვეყნება</strong><small>მომსახურება გამოჩნდება ავტოსერვისის გვერდზე.</small></span></label>
      <div className="inventory-editor-actions">
        <button className="inventory-button is-primary" type="submit" disabled={pending}>{pending ? 'ინახება…' : 'შენახვა'}</button>
        <button className="inventory-button" type="button" disabled={pending} onClick={() => { setError(''); closeEditor(); }}>გაუქმება</button>
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
