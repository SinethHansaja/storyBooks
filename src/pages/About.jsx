import { Link } from 'react-router-dom';
import { useStore } from '../lib/state';
import { fmtMoney } from '../lib/format';

export default function About() {
  const { settings } = useStore();
  const faqs = [
    ['How long does delivery take?', 'Most orders arrive within 2–4 working days island-wide. Colombo orders often arrive next day.'],
    ['How much is delivery?', `A flat ${fmtMoney(settings?.shipping_flat)} — and free on orders over ${fmtMoney(settings?.free_shipping_over)}.`],
    ['Can I return a book?', 'Of course. If a book arrives damaged or isn’t quite right, contact us within 7 days and we’ll make it right.'],
    ['How do eBooks work?', 'After payment is confirmed we email you a download link. Read on any tablet, phone or computer.'],
    ['Do you gift wrap?', 'Yes! Tick “gift wrap” at checkout and add a message — we’ll hand-write it on a card.'],
  ];
  return (
    <div className="container section narrow about">
      <span className="eyebrow">✨ Our story</span>
      <h1>Once upon a time, there was a bookshop…</h1>
      <p>…started by two parents who believed every child deserves a shelf full of wonder. We hand-pick each title for its heart, its humour and its pictures, so bedtime becomes everyone’s favourite time.</p>
      <div className="promises">
        <div className="promise"><span>📚</span><b>Curated</b><small>Every book read before it’s sold</small></div>
        <div className="promise"><span>🌱</span><b>Thoughtful</b><small>Recyclable, plastic-free packaging</small></div>
        <div className="promise"><span>🤝</span><b>Local</b><small>Supporting local authors & illustrators</small></div>
      </div>
      <h2 id="faq">Frequently asked questions</h2>
      <div className="faq" id="shipping">
        {faqs.map(([q, a]) => <details key={q} className="card"><summary>{q}</summary><p>{a}</p></details>)}
      </div>
      <div className="card center">
        <h3>Still curious?</h3>
        <p>Write to <a className="link" href={`mailto:${settings?.contact_email}`}>{settings?.contact_email}</a> or call <a className="link" href={`tel:${settings?.contact_phone}`}>{settings?.contact_phone}</a>.</p>
        <Link to="/shop" className="btn">Explore books</Link>
      </div>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="container section center">
      <div className="empty-icon">🧚</div>
      <h1>This page flew away</h1>
      <p className="muted">Even fairies get lost sometimes.</p>
      <Link to="/" className="btn">Take me home</Link>
    </div>
  );
}
