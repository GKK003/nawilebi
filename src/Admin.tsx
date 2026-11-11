import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronRight, CircleAlert,
  Eye, EyeOff, ImagePlus, LayoutGrid, LockKeyhole, LogOut, Package, Pencil,
  MapPin, Plus, RefreshCw, Search, Trash2, Upload, X,
} from 'lucide-react'
import {
  CONDITIONS, IMAGE_MIME_TYPES, MAX_IMAGES, MAX_IMAGE_BYTES,
  formatPrice, stockStatus, type Part, type PartInput,
} from './catalog'
import {
  PartSaveUnconfirmedError, deletePart, discardUploads, getAdminSession, imageUrl,
  listAdminParts, listPartViewerCounts, readStoreContact, savePart, saveStoreContact, signIn, signOut, uploadPartImages, type StoreContact,
} from './repository'
import './admin.css'

type AdminSession = NonNullable<Awaited<ReturnType<typeof getAdminSession>>>
type PartImage = Part['images'][number]
type DraftImage =
  | { id: string; url: string; alt: string; path: string; file?: never }
  | { id: string; url: string; alt: string; file: File; path?: never }

const countFormatter = new Intl.NumberFormat('ka-GE')

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function AdminHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="inventory-header">
      <div className="inventory-header-inner">
        <a className="inventory-brand" href="#" aria-label="ნაწილების კატალოგი">
          <img className="inventory-brand-icon" src="/mark.svg" width="40" height="40" alt="" />
          <span>ნაწილები<span className="inventory-brand-dot">.</span><span className="inventory-brand-subtitle">მართვის პანელი</span></span>
        </a>
        <div className="inventory-header-actions">
          <a className="inventory-backlink" href="#" aria-label="კატალოგში დაბრუნება"><ArrowLeft size={16} /><span>კატალოგი</span></a>
          {children}
        </div>
      </div>
    </header>
  )
}

function Feedback({ children, success = false }: { children: ReactNode; success?: boolean }) {
  const Icon = success ? Check : CircleAlert
  return <div className={`inventory-feedback ${success ? 'is-success' : ''}`} role={success ? 'status' : 'alert'}><Icon size={18} /><span>{children}</span></div>
}

function Login({ onSession }: { onSession: (session: AdminSession) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      onSession(await signIn(email.trim(), password))
    } catch (error) {
      setError(errorMessage(error, 'შესვლა ვერ მოხერხდა. შეამოწმეთ მონაცემები და სცადეთ ხელახლა.'))
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="inventory-login-wrap" id="main-content">
      <section className="inventory-login inventory-card" aria-labelledby="inventory-login-title">
        <div className="inventory-login-icon"><LockKeyhole size={24} /></div>
        <p className="inventory-kicker">ადმინისტრირება</p>
        <h1 id="inventory-login-title">მართვის პანელი</h1>
        <p className="inventory-subtitle">შედით თქვენი ანგარიშით ნაწილებისა და მარაგის სამართავად.</p>
        {error && <Feedback>{error}</Feedback>}
        <form className="inventory-login-form" onSubmit={submit}>
            <label className="inventory-field">
              <span>ელფოსტა</span>
              <input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" required />
            </label>
            <div className="inventory-field">
              <label htmlFor="inventory-password">პაროლი</label>
              <span className="inventory-password">
                <input id="inventory-password" type={visible ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required />
                <button type="button" className="inventory-icon-btn" aria-label={visible ? 'პაროლის დამალვა' : 'პაროლის ჩვენება'} onClick={() => setVisible(!visible)}>
                  {visible ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </span>
            </div>
          <button className="inventory-button is-primary" disabled={pending} type="submit">
            {pending ? 'შესვლა…' : 'შესვლა'} <ArrowRight size={17} />
          </button>
        </form>
      </section>
    </main>
  )
}

type InventoryFilter = 'all' | 'published' | 'hidden' | 'out'

const FILTERS: { value: InventoryFilter; label: string }[] = [
  { value: 'all', label: 'ყველა' },
  { value: 'published', label: 'კატალოგში' },
  { value: 'hidden', label: 'დამალული' },
  { value: 'out', label: 'ამოწურული' },
]

function InventoryList({ parts, viewerCounts, onNew, onEdit, onRemove, onRefresh }: {
  parts: Part[]
  viewerCounts: Record<string, number> | null
  onNew: () => void
  onEdit: (part: Part) => void
  onRemove: (part: Part) => void
  onRefresh: () => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<InventoryFilter>('all')
  const search = query.trim().toLowerCase()
  const matchingParts = parts.filter(part => {
    if (filter === 'published' && !part.is_published) return false
    if (filter === 'hidden' && part.is_published) return false
    if (filter === 'out' && part.quantity !== 0) return false
    return [part.name, part.category, part.make, part.model, part.oem_number].some(value => value?.toLowerCase().includes(search))
  })
  const publishedCount = parts.filter(part => part.is_published).length
  const stockCount = parts.filter(part => part.quantity > 0).length

  return (
    <>
      <div className="inventory-page-heading">
        <div>
          <p className="inventory-kicker">ადმინისტრირება</p>
          <h1>ნაწილების მართვა</h1>
          <p className="inventory-subtitle">დაამატეთ ნაწილები, განაახლეთ ფასი და აკონტროლეთ მარაგი.</p>
        </div>
        <div className="inventory-heading-actions">
          <a className="inventory-button" href="#admin/contact"><MapPin size={17} /> კონტაქტი</a>
          <button className="inventory-button is-primary" onClick={onNew}><Plus size={19} /> ნაწილის დამატება</button>
        </div>
      </div>
      <div className="inventory-stats">
        <div className="inventory-stat inventory-card"><span className="inventory-stat-icon"><LayoutGrid size={20} /></span><span>სულ ნაწილები<strong>{countFormatter.format(parts.length)}</strong></span></div>
        <div className="inventory-stat inventory-card"><span className="inventory-stat-icon is-blue"><Eye size={20} /></span><span>კატალოგშია<strong>{countFormatter.format(publishedCount)}</strong></span></div>
        <div className="inventory-stat inventory-card"><span className="inventory-stat-icon is-green"><Package size={20} /></span><span>მარაგშია<strong>{countFormatter.format(stockCount)}</strong></span></div>
      </div>
      <section className="inventory-card inventory-list" aria-labelledby="inventory-list-title">
        <div className="inventory-list-heading">
          <div><h2 id="inventory-list-title">ინვენტარი</h2><p>{countFormatter.format(matchingParts.length)} შედეგი</p></div>
          <div className="inventory-list-filters">
            <label className="inventory-search">
              <Search size={18} />
              <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="ძებნა…" title="სახელი, კატეგორია ან OEM" aria-label="ინვენტარში ძებნა" />
            </label>
            <select aria-label="ინვენტარის ფილტრი" value={filter} onChange={event => setFilter(event.target.value as InventoryFilter)}>
              {FILTERS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button className="inventory-icon-btn inventory-refresh" type="button" onClick={onRefresh} title="სიის განახლება" aria-label="სიის განახლება"><RefreshCw size={16} /></button>
          </div>
        </div>
        {matchingParts.length ? (
          <div className="inventory-table-wrap">
            <table className="inventory-table" role="table">
              <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">ნაწილი</th><th scope="col" role="columnheader">ფასი</th><th scope="col" role="columnheader">მარაგი</th><th scope="col" role="columnheader">ხილვადობა</th><th scope="col" role="columnheader"><span className="inventory-sr-only">მოქმედებები</span></th></tr></thead>
              <tbody role="rowgroup">
                {matchingParts.map(part => {
                  const stock = stockStatus(part.quantity)
                  return (
                    <tr key={part.id} role="row">
                      <td className="inventory-table-part" role="cell">
                        <div className="inventory-item">
                          <div className="inventory-item-image">
                            {part.images[0] ? <img src={imageUrl(part.images[0].path)} alt="" loading="lazy" /> : <Package size={22} />}
                          </div>
                          <div>
                            <button className="inventory-part-link" onClick={() => onEdit(part)}>{part.name}</button>
                            <span>{part.category}</span>
                            {viewerCounts && <span><Eye size={13} aria-hidden="true" /> {countFormatter.format(viewerCounts[part.id] ?? 0)} მნახველი</span>}
                          </div>
                        </div>
                      </td>
                      <td className="inventory-table-price" role="cell">{formatPrice(part.price)}</td>
                      <td className="inventory-table-stock" role="cell"><span className={`inventory-badge is-${stock.tone}`}>{stock.label}</span><span className="inventory-table-quantity">{countFormatter.format(part.quantity)} ც.</span></td>
                      <td className="inventory-table-visibility" role="cell"><span className={`inventory-badge ${part.is_published ? 'is-published' : ''}`}>{part.is_published ? 'გამოქვეყნებული' : 'დამალული'}</span></td>
                      <td className="inventory-table-actions" role="cell">
                        <div className="inventory-row-actions">
                          <button type="button" className="inventory-icon-btn" onClick={() => onEdit(part)} aria-label={`${part.name} · რედაქტირება`} title="რედაქტირება"><Pencil size={17} /></button>
                          <button type="button" className="inventory-icon-btn is-danger" onClick={() => onRemove(part)} aria-label={`${part.name} · წაშლა`} title="წაშლა"><Trash2 size={17} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="inventory-empty">
            <Package size={27} />
            <h3>{parts.length ? 'ნაწილები ვერ მოიძებნა' : 'ინვენტარი ცარიელია'}</h3>
            <p>{parts.length ? 'სცადეთ სხვა საძიებო სიტყვა ან ფილტრი.' : 'დაამატეთ პირველი ნაწილი კატალოგში.'}</p>
            {!parts.length && <button className="inventory-button" onClick={onNew}><Plus size={17} /> ნაწილის დამატება</button>}
          </div>
        )}
      </section>
    </>
  )
}

function PartEditor({ part, onCancel, onSaved }: { part: Part | null; onCancel: () => void; onSaved: (part: Part) => void }) {
  const [partId] = useState(() => part?.id ?? crypto.randomUUID())
  const [images, setImages] = useState<DraftImage[]>(() => part?.images.map(image => ({ ...image, id: image.path, url: imageUrl(image.path) })) ?? [])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [imageError, setImageError] = useState('')
  const [dirty, setDirty] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const objectUrls = useRef(new Set<string>())

  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    const previews = objectUrls.current
    return () => previews.forEach(url => URL.revokeObjectURL(url))
  }, [])

  function cancel() {
    if (!dirty || window.confirm('შენახვის გარეშე დაბრუნება გსურთ?')) onCancel()
  }

  function addFiles(files: FileList) {
    const chosen = [...files]
    setImageError('')
    if (chosen.length + images.length > MAX_IMAGES) {
      setImageError(`ერთ ნაწილზე მაქსიმუმ ${MAX_IMAGES} ფოტოს დამატებაა შესაძლებელი.`)
      return
    }
    if (chosen.some(file => !IMAGE_MIME_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES || file.size === 0)) {
      setImageError('აირჩიეთ JPG, PNG, WebP ან AVIF ფოტო, მაქსიმუმ 8 მბ თითო ფაილზე.')
      return
    }
    const added = chosen.map(file => {
      const url = URL.createObjectURL(file)
      objectUrls.current.add(url)
      return { id: url, url, file, alt: '' }
    })
    setImages([...images, ...added])
    if (added.length) setDirty(true)
  }

  function moveImage(index: number, direction: -1 | 1) {
    const next = [...images]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    const [image] = next.splice(index, 1)
    next.splice(target, 0, image)
    setImages(next)
    setDirty(true)
  }

  function removeImage(image: DraftImage) {
    if (objectUrls.current.delete(image.url)) URL.revokeObjectURL(image.url)
    setImages(images.filter(item => item.id !== image.id))
    setImageError('')
    setDirty(true)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const data = new FormData(event.currentTarget)
    const value = (name: string) => String(data.get(name) ?? '').trim()
    const number = (name: string) => value(name) ? Number(value(name)) : null
    const name = value('name')
    const category = value('category')
    const yearFrom = number('year_from')
    const yearTo = number('year_to')
    setError('')
    if (!name || !category) {
      setError('მიუთითეთ ნაწილის სახელი და კატეგორია.')
      return
    }
    if (yearFrom !== null && yearTo !== null && yearFrom > yearTo) {
      setError('საწყისი წელი საბოლოო წელზე მეტი ვერ იქნება.')
      return
    }

    const input: PartInput = {
      id: partId, name, category,
      condition: value('condition') as PartInput['condition'],
      make: value('make') || null,
      model: value('model') || null,
      year_from: yearFrom,
      year_to: yearTo,
      oem_number: value('oem_number') || null,
      price: number('price'),
      quantity: Number(value('quantity')),
      description: value('description'),
      is_published: data.has('is_published'),
      is_featured: data.has('is_featured'),
      images: [],
    }

    setPending(true)
    let uploaded: PartImage[] = []
    let saved: Part
    try {
      const files = images.flatMap(image => image.file ? [image.file] : [])
      if (files.length) uploaded = await uploadPartImages(partId, files)
      let uploadIndex = 0
      input.images = images.map(image => ({ path: image.path ?? uploaded[uploadIndex++].path, alt: image.alt.trim() }))
      saved = await savePart(input, part?.updated_at)
    } catch (error) {
      if (uploaded.length && !(error instanceof PartSaveUnconfirmedError)) {
        await discardUploads(uploaded).catch(() => undefined)
      }
      setError(errorMessage(error, 'შენახვა ვერ მოხერხდა. სცადეთ ხელახლა.'))
      return
    } finally {
      setPending(false)
    }
    onSaved(saved)
  }

  return (
    <>
      <button className="inventory-breadcrumb" type="button" onClick={cancel} disabled={pending}><ArrowLeft size={16} /> ინვენტარი <ChevronRight size={14} /></button>
      <div className="inventory-page-heading inventory-editor-heading">
        <div>
          <h1 ref={heading} tabIndex={-1}>{part ? 'ნაწილის რედაქტირება' : 'ახალი ნაწილის დამატება'}</h1>
          <p className="inventory-subtitle">{part?.name ?? 'შეავსეთ მონაცემები, დაამატეთ ფოტოები და აირჩიეთ ხილვადობა.'}</p>
        </div>
      </div>
      <form className="inventory-editor" onSubmit={submit} onChange={() => setDirty(true)}>
        {error && <Feedback>{error}</Feedback>}
        <fieldset className="inventory-editor-layout" disabled={pending}>
          <div className="inventory-editor-main">
            <section className="inventory-card inventory-form-card" aria-labelledby="inventory-details-title">
              <h2 id="inventory-details-title">ძირითადი ინფორმაცია</h2>
              <div className="inventory-field-grid">
                <label className="inventory-field is-full"><span>ნაწილის სახელი <span className="inventory-required">*</span></span><input name="name" defaultValue={part?.name} maxLength={160} required /></label>
                <label className="inventory-field"><span>კატეგორია <span className="inventory-required">*</span></span><input name="category" defaultValue={part?.category} placeholder="მაგ. გადაცემათა კოლოფი" maxLength={80} required /></label>
                <label className="inventory-field"><span>მწარმოებლის ნომერი (OEM)</span><input name="oem_number" defaultValue={part?.oem_number ?? ''} maxLength={120} /></label>
                <label className="inventory-field"><span>მდგომარეობა <span className="inventory-required">*</span></span><select name="condition" defaultValue={part?.condition ?? 'new'} required>{CONDITIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <label className="inventory-field is-full"><span>აღწერა</span><textarea name="description" defaultValue={part?.description} rows={4} maxLength={5000} placeholder="მაგალითად, ნაწილის მდგომარეობა და თავსებადობა" /></label>
              </div>
            </section>
            <section className="inventory-card inventory-form-card" aria-labelledby="inventory-fit-title">
              <h2 id="inventory-fit-title">ავტომობილთან თავსებადობა</h2>
              <div className="inventory-field-grid">
                <label className="inventory-field"><span>მარკა</span><input name="make" defaultValue={part?.make ?? ''} placeholder="მაგ. Toyota" maxLength={80} /></label>
                <label className="inventory-field"><span>მოდელი</span><input name="model" defaultValue={part?.model ?? ''} placeholder="მაგ. Corolla" maxLength={80} /></label>
                <label className="inventory-field"><span>საწყისი წელი</span><input name="year_from" type="number" defaultValue={part?.year_from ?? ''} placeholder="2017" min={1886} max={2100} step={1} /></label>
                <label className="inventory-field"><span>საბოლოო წელი</span><input name="year_to" type="number" defaultValue={part?.year_to ?? ''} placeholder="2022" min={1886} max={2100} step={1} /></label>
              </div>
            </section>
            <section className="inventory-card inventory-form-card" aria-labelledby="inventory-photos-title">
              <div className="inventory-photo-heading">
                <div><h2 id="inventory-photos-title">ფოტოები</h2><p>პირველი ფოტო გამოჩნდება კატალოგში მთავარ ფოტოდ.</p></div>
                <span className="inventory-photo-count">{images.length} / {MAX_IMAGES}</span>
              </div>
              {images.length > 0 && (
                <div className="inventory-photo-grid">
                  {images.map((image, index) => (
                    <div key={image.id} className="inventory-photo">
                      <div className="inventory-photo-preview">
                        <img src={image.url} alt={image.alt} />
                        {index === 0 && <span className="inventory-cover-badge">მთავარი</span>}
                      </div>
                      <div className="inventory-photo-controls">
                        <button className="inventory-icon-btn" type="button" disabled={pending || index === 0} onClick={() => moveImage(index, -1)} aria-label={`ფოტო ${index + 1} · წინ გადატანა`} title="წინ გადატანა"><ArrowUp size={16} /></button>
                        <button className="inventory-icon-btn" type="button" disabled={pending || index === images.length - 1} onClick={() => moveImage(index, 1)} aria-label={`ფოტო ${index + 1} · უკან გადატანა`} title="უკან გადატანა"><ArrowDown size={16} /></button>
                        <button className="inventory-icon-btn is-danger" type="button" onClick={() => removeImage(image)} aria-label={`ფოტო ${index + 1} · წაშლა`} title="ფოტოს წაშლა"><X size={18} /></button>
                      </div>
                      <input className="inventory-photo-alt" value={image.alt} maxLength={160} aria-label={`ფოტო ${index + 1} · ტექსტური აღწერა`} placeholder="ფოტოს აღწერა" onChange={event => {
                        const alt = event.target.value
                        setImages(images.map(item => item.id === image.id ? { ...item, alt } : item))
                      }} />
                    </div>
                  ))}
                </div>
              )}
              {imageError && <Feedback>{imageError}</Feedback>}
              {images.length < MAX_IMAGES && (
                <label className="inventory-dropzone">
                  <input className="inventory-sr-only" type="file" accept={IMAGE_MIME_TYPES.join(',')} multiple onChange={event => {
                    if (event.currentTarget.files) addFiles(event.currentTarget.files)
                    event.currentTarget.value = ''
                  }} />
                  <ImagePlus size={25} />
                  <strong>აირჩიეთ ფოტოები</strong>
                  <span>JPG, PNG, WebP ან AVIF · თითოეული მაქს. 8 მბ</span>
                </label>
              )}
            </section>
          </div>
          <div className="inventory-editor-side">
            <section className="inventory-card inventory-form-card" aria-labelledby="inventory-price-title">
              <h2 id="inventory-price-title">ფასი და მარაგი</h2>
              <label className="inventory-field"><span>ფასი (₾)</span><input name="price" type="number" inputMode="decimal" defaultValue={part?.price ?? ''} placeholder="0.00" min={0} max={9999999999.99} step={0.01} /><small>ცარიელი ველის შემთხვევაში ფასი შეთანხმებით იქნება.</small></label>
              <label className="inventory-field"><span>რაოდენობა <span className="inventory-required">*</span></span><input name="quantity" type="number" inputMode="numeric" defaultValue={part?.quantity ?? 0} min={0} max={999999} step={1} required /><small>0 რაოდენობისას ნაწილი გამოჩნდება როგორც ამოწურული.</small></label>
            </section>
            <section className="inventory-card inventory-form-card" aria-labelledby="inventory-visibility-title">
              <h2 id="inventory-visibility-title">ხილვადობა</h2>
              <label className="inventory-check"><input type="checkbox" name="is_published" defaultChecked={part?.is_published ?? false} /><span><strong>გამოქვეყნება</strong><small>მომხმარებლები ნაწილს კატალოგში ნახავენ.</small></span></label>
              <label className="inventory-check"><input type="checkbox" name="is_featured" defaultChecked={part?.is_featured ?? false} /><span><strong>გამორჩეული ნაწილი</strong><small>გამოქვეყნებული ნაწილი გამორჩეულად მოინიშნება.</small></span></label>
            </section>
            <div className="inventory-editor-actions">
              <button className="inventory-button is-primary" type="submit"><Upload size={17} /> {pending ? 'ინახება…' : 'შენახვა'}</button>
              <button className="inventory-button" type="button" onClick={cancel}>გაუქმება</button>
            </div>
          </div>
        </fieldset>
      </form>
    </>
  )
}

function DeleteDialog({ part, onClose, onDeleted }: { part: Part; onClose: () => void; onDeleted: (part: Part) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  async function remove() {
    setPending(true)
    setError('')
    try {
      await deletePart(part)
      onDeleted(part)
    } catch (error) {
      setError(errorMessage(error, 'ნაწილის წაშლა ვერ მოხერხდა. სცადეთ ხელახლა.'))
      setPending(false)
    }
  }

  return (
    <dialog className="inventory-dialog" ref={dialog} aria-labelledby="inventory-delete-title" onCancel={event => {
      event.preventDefault()
      if (!pending) onClose()
    }}>
      <span className="inventory-delete-icon"><Trash2 size={24} /></span>
      <h2 id="inventory-delete-title">წავშალოთ ეს ნაწილი?</h2>
      <p><strong>{part.name}</strong> წაიშლება ინვენტარიდან და კატალოგიდან.</p>
      {error && <Feedback>{error}</Feedback>}
      <div className="inventory-dialog-actions">
        <button type="button" className="inventory-button" disabled={pending} autoFocus onClick={onClose}>გაუქმება</button>
        <button type="button" className="inventory-button is-destructive" disabled={pending} onClick={remove}>{pending ? 'იშლება…' : 'წაშლა'}</button>
      </div>
    </dialog>
  )
}

function ContactSettings() {
  const [contact, setContact] = useState<StoreContact | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let current = true
    readStoreContact().then(result => {
      if (current) setContact(result)
    }).catch(failure => {
      if (current) setError(errorMessage(failure, 'საკონტაქტო მონაცემები ვერ ჩაიტვირთა.'))
    })
    return () => { current = false }
  }, [attempt])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setError('')
    setSaved(false)

    const form = new FormData(event.currentTarget)
    const field = (name: string) => String(form.get(name) ?? '').trim() || null
    const phone = field('phone')?.replace(/\s+/g, ' ') ?? null
    const digits = phone?.replace(/\D/g, '').length ?? 0
    if (phone && (!/^\+?[0-9(). -]+$/.test(phone) || digits < 6 || digits > 15)) {
      setError('მიუთითეთ მოქმედი ტელეფონის ნომერი.')
      return
    }

    let mapUrl = field('map_url')
    if (mapUrl) {
      try {
        const parsed = new URL(mapUrl)
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.href.length > 2048) throw new Error()
        mapUrl = parsed.href
      } catch {
        setError('რუკის ბმული უნდა იწყებოდეს https://-ით.')
        return
      }
    }

    setPending(true)
    try {
      await saveStoreContact({ phone, address: field('address'), map_url: mapUrl })
      setSaved(true)
    } catch (failure) {
      setError(errorMessage(failure, 'საკონტაქტო მონაცემები ვერ შეინახა.'))
    } finally {
      setPending(false)
    }
  }

  return <>
    <a className="inventory-breadcrumb" href="#admin"><ArrowLeft size={16} /> ინვენტარი</a>
    <div className="inventory-page-heading">
      <div><h1>საკონტაქტო მონაცემები</h1><p className="inventory-subtitle">ეს ინფორმაცია მომხმარებლებს ნაწილის გვერდზე გამოუჩნდებათ.</p></div>
    </div>
    {!contact && (error
      ? <><Feedback>{error}</Feedback><button type="button" className="inventory-button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>ხელახლა ჩატვირთვა</button></>
      : <p role="status">იტვირთება…</p>)}
    {contact && <form className="inventory-card inventory-form-card inventory-contact-form" onSubmit={submit} onChange={() => setSaved(false)}>
      {error && <Feedback>{error}</Feedback>}
      {saved && <Feedback success>საკონტაქტო მონაცემები გამოქვეყნდა.</Feedback>}
      <label className="inventory-field"><span>ტელეფონის ნომერი</span><input name="phone" type="tel" autoComplete="tel" maxLength={40} defaultValue={contact.phone ?? ''} disabled={pending} /></label>
      <label className="inventory-field"><span>მისამართი</span><input name="address" autoComplete="street-address" maxLength={240} defaultValue={contact.address ?? ''} disabled={pending} /></label>
      <label className="inventory-field"><span>რუკის ბმული (არასავალდებულო)</span><input name="map_url" type="url" maxLength={2048} defaultValue={contact.map_url ?? ''} aria-describedby="map-help" disabled={pending} /></label>
      <p className="inventory-subtitle" id="map-help">რუკა მისამართით იხსნება. ზუსტი წერტილის საჩვენებლად ჩასვით რუკის ბმული.</p>
      <div className="inventory-editor-actions"><button className="inventory-button is-primary" disabled={pending} type="submit">{pending ? 'ინახება…' : 'შენახვა'}</button></div>
    </form>}
  </>
}

export default function Admin({ showContact }: { showContact: boolean }) {
  const [session, setSession] = useState<AdminSession | null | undefined>(undefined)
  const [parts, setParts] = useState<Part[] | null>(null)
  const [viewerCounts, setViewerCounts] = useState<Record<string, number> | null>(null)
  const [editor, setEditor] = useState<{ part: Part | null } | null>(null)
  const [toDelete, setToDelete] = useState<Part | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    let current = true
    getAdminSession().then(result => {
      if (current) setSession(result)
    }).catch(error => {
      if (current) {
        setError(errorMessage(error, 'სესიის შემოწმება ვერ მოხერხდა.'))
        setSession(null)
      }
    })
    return () => { current = false }
  }, [])

  useEffect(() => {
    if (!session || showContact) return
    let current = true
    listAdminParts().then(result => {
      if (current) setParts(result)
    }).catch(error => {
      if (current) setError(errorMessage(error, 'ინვენტარის ჩატვირთვა ვერ მოხერხდა.'))
    })
    listPartViewerCounts().then(counts => {
      if (current) setViewerCounts(counts)
    }).catch(() => {})
    return () => { current = false }
  }, [session, attempt, showContact])

  function openEditor(part: Part | null) {
    setEditor({ part })
    setNotice('')
    setError('')
    window.scrollTo({ top: 0 })
  }

  function handleSaved(saved: Part) {
    setParts(previous => [saved, ...(previous ?? []).filter(part => part.id !== saved.id)])
    setEditor(null)
    setNotice('ნაწილი შენახულია.')
    window.scrollTo({ top: 0 })
  }

  async function leave() {
    setLeaving(true)
    setError('')
    try {
      await signOut()
      setSession(null)
      setParts(null)
      setViewerCounts(null)
      setEditor(null)
      setNotice('')
    } catch (error) {
      setError(errorMessage(error, 'გასვლა ვერ მოხერხდა. სცადეთ ხელახლა.'))
    } finally {
      setLeaving(false)
    }
  }

  function refresh() {
    setParts(null)
    setNotice('')
    setError('')
    setAttempt(previous => previous + 1)
  }

  return (
    <div className="inventory">
      <AdminHeader>{session && <button className="inventory-button inventory-signout" onClick={leave} disabled={leaving} aria-label="გასვლა"><LogOut size={17} /><span>გასვლა</span></button>}</AdminHeader>
      {session === undefined && <main className="inventory-content" id="main-content"><p role="status">იტვირთება…</p></main>}
      {session === null && <>
        {error && <div className="inventory-content inventory-session-error"><Feedback>{error}</Feedback></div>}
        <Login onSession={result => { setError(''); setSession(result) }} />
      </>}
      {session && (
        <main className="inventory-content" id="main-content">
          {showContact ? <ContactSettings /> : <>
            {error && <Feedback>{error}</Feedback>}
            {notice && <Feedback success>{notice}</Feedback>}
            {editor ? <PartEditor key={editor.part?.id ?? 'new'} part={editor.part} onCancel={() => setEditor(null)} onSaved={handleSaved} />
              : parts ? <InventoryList parts={parts} viewerCounts={viewerCounts} onNew={() => openEditor(null)} onEdit={openEditor} onRemove={setToDelete} onRefresh={refresh} />
              : error ? <button className="inventory-button" type="button" onClick={refresh}>ხელახლა ჩატვირთვა</button>
              : <p role="status">ინვენტარი იტვირთება…</p>}
            {toDelete && <DeleteDialog part={toDelete} onClose={() => setToDelete(null)} onDeleted={deleted => {
              setParts(previous => previous?.filter(part => part.id !== deleted.id) ?? [])
              setToDelete(null)
              setNotice('ნაწილი წაშლილია.')
            }} />}
          </>}
        </main>
      )}
    </div>
  )
}
