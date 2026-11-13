import { useEffect, useState } from 'react';
import { ArrowLeft, Wrench } from 'lucide-react';
import { formatServicePrice, type MechanicService } from './catalog';
import { listServices, type StoreContact } from './repository';
import { ContactLinks, hasContact } from './storefront-ui';

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
      : <ul className="service-list">{services.map((service) => <li className="service-card" key={service.id}>
        <div className="service-card-icon" aria-hidden="true"><Wrench size={20} /></div>
        <div className="service-card-details">
          <h2>{service.name}</h2>
          {service.description && <p>{service.description}</p>}
        </div>
        <strong className="service-price">{formatServicePrice(service)}</strong>
      </li>)}</ul>}
  </main>;
}
