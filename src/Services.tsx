import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Wrench } from 'lucide-react';
import { formatServicePrice, type MechanicService } from './catalog';
import { listServices, type StoreContact } from './repository';
import { ContactLinks, hasContact, PartPhoto } from './storefront-ui';

function ServiceCard({ service }: { service: MechanicService }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const { images } = service;
  const photo = images[photoIndex];

  function movePhoto(direction: number) {
    setPhotoIndex((current) => (current + direction + images.length) % images.length);
  }

  return <li className={`service-card${photo ? ' has-photo' : ''}`}>
    {photo && <div className="service-media" role="group" aria-label={`ფოტოები · ${service.name}`}>
      <PartPhoto path={photo.path} alt={photo.alt || `${service.name} · ფოტო ${photoIndex + 1}`} variant="service" />
      {images.length > 1 && <div className="service-photo-controls">
        <button type="button" aria-label="წინა ფოტო" onClick={() => movePhoto(-1)}><ChevronLeft size={18} /></button>
        <span aria-live="polite">{photoIndex + 1} / {images.length}</span>
        <button type="button" aria-label="შემდეგი ფოტო" onClick={() => movePhoto(1)}><ChevronRight size={18} /></button>
      </div>}
    </div>}
    <div className="service-card-details">
      {!photo && <div className="service-card-icon" aria-hidden="true"><Wrench size={20} /></div>}
      <h2>{service.name}</h2>
      {service.description && <p>{service.description}</p>}
      <div className="service-card-price"><strong>{formatServicePrice(service)}</strong></div>
    </div>
  </li>;
}

export default function Services({ contact }: { contact: StoreContact }) {
  const [services, setServices] = useState<MechanicService[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    listServices(true).then((items) => {
      if (current) setServices(items);
    }).catch(() => {
      if (current) setError('მომსახურებები ვერ ჩაიტვირთა.');
    });
    return () => { current = false; };
  }, [attempt]);

  return <main id="main-content" tabIndex={-1} className="shell services-page">
    <a className="back-link" href="#"><ArrowLeft size={17} /> მთავარ გვერდზე დაბრუნება</a>
    <div className="services-intro">
      <div><h1>ავტოსერვისი</h1><p>გაეცანი მომსახურებებსა და ფასებს.</p></div>
      {hasContact(contact) && <ContactLinks contact={contact} />}
    </div>
    {error ? <div className="empty-state" role="alert">
      <strong>{error}</strong>
      <button className="button secondary" onClick={() => { setError(''); setAttempt((value) => value + 1); }}>ხელახლა ცდა</button>
    </div> : services === null ? <p role="status">იტვირთება…</p>
      : services.length === 0 ? <div className="empty-state"><Wrench size={28} /><strong>მომსახურებები ჯერ არ დამატებულა</strong></div>
      : <ul className="service-list">{services.map((service) => <ServiceCard service={service} key={service.id} />)}</ul>}
  </main>;
}
