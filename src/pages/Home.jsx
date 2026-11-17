import { lazy, Suspense, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/state';
import { AGE_GROUPS, CATEGORIES } from '../lib/config';
import { BookCard, Spinner } from '../components/ui';

const FairytaleScene = lazy(() => import('../components/FairytaleScene'));

const CAT_ICONS = { 'Fairy Tales': '🏰', 'Bedtime Stories': '🌙', Adventure: '🗺️', Animals: '🦊', 'Picture Books': '🎨', 'Early Learning': '🔤', Fantasy: '🪄', Friendship: '🤝', 'Rhymes & Poems': '🎶' };
const AGE_ICONS = ['🍼', '🧸', '🎈', '🚀'];

export default function Home() {
  const { books, booksLoading, toast } = useStore();
  const nav = useNavigate();
  const featured = useMemo(() => {
    const f = books.filter((b) => b.featured);
    return (f.length ? f : books).slice(0, 6);
  }, [books]);
  const newest = useMemo(() => [...books].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 4), [books]);
  const best = useMemo(() => [...books].sort((a, b) => b.rating_count - a.rating_count).slice(0, 4), [books]);

  return (
    <>
      <section className="hero">
        <div className="hero-canvas">
          <Suspense fallback={<div className="scene scene-fallback" />}>
            <FairytaleScene books={featured} onBookClick={(b) => nav(`/book/${b.slug}`)} />
          </Suspense>
        </div>
        <div className="container hero-copy">
          <span className="eyebrow">✨ Once upon a time…</span>
          <h1>Stories that make little hearts <em>sparkle</em></h1>
          <p>Hand-picked picture books, bedtime tales and first chapter books for dreamers aged 0–12 — delivered to your door with a sprinkle of magic.</p>
          <div className="hero-cta">
            <Link to="/shop" className="btn btn-lg">Explore the library 📚</Link>
            <Link to="/shop?cat=Bedtime%20Stories" className="btn btn-lg btn-ghost">Bedtime picks 🌙</Link>
          </div>
          <small className="hero-hint">Psst… tap a floating book to open it 🪄</small>
        </div>
      </section>

      <section className="container section">
        <div className="section-head"><h2>Shop by age</h2><p>Just-right stories for every stage</p></div>
        <div className="age-grid">
          {AGE_GROUPS.map((g, i) => (
            <Link key={g.label} to={`/shop?age=${g.min}-${g.max}`} className={`age-card age-${i}`}>
              <span className="age-icon">{AGE_ICONS[i]}</span>
              <b>{g.label}</b>
              <small>{['Board & touch books', 'Picture books', 'Early readers', 'Chapter books'][i]}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="section-head"><h2>Featured enchantments</h2><Link to="/shop" className="link">See all →</Link></div>
        {booksLoading ? <Spinner /> : <div className="grid">{featured.slice(0, 4).map((b) => <BookCard key={b.id} book={b} />)}</div>}
      </section>

      <section className="container section">
        <div className="section-head"><h2>Wander through worlds</h2></div>
        <div className="cat-cloud">
          {CATEGORIES.map((c) => (
            <Link key={c} to={`/shop?cat=${encodeURIComponent(c)}`} className="cat-pill">
              <span>{CAT_ICONS[c]}</span>{c}
            </Link>
          ))}
        </div>
      </section>

      <section className="container section split">
        <div>
          <div className="section-head"><h2>Fresh off the press</h2></div>
          <div className="grid grid-2">{newest.map((b) => <BookCard key={b.id} book={b} />)}</div>
        </div>
        <div>
          <div className="section-head"><h2>Little readers love</h2></div>
          <div className="grid grid-2">{best.map((b) => <BookCard key={b.id} book={b} />)}</div>
        </div>
      </section>

      <section className="container section promises">
        {[
          ['🚚', 'Island-wide delivery', 'Wrapped with care, delivered to your door'],
          ['🎁', 'Gift wrapping', 'Add a handwritten note for birthdays'],
          ['💳', 'Pay your way', 'Cash on delivery, bank transfer or card'],
          ['💖', 'Hand-picked', 'Every book read & loved by our team'],
        ].map(([i, t, d]) => (
          <div key={t} className="promise"><span>{i}</span><b>{t}</b><small>{d}</small></div>
        ))}
      </section>

      <section className="container section">
        <div className="newsletter">
          <div>
            <h2>Join the Story Club 💌</h2>
            <p>New arrivals, reading tips and members-only treats — once a month, never spammy.</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); e.currentTarget.reset(); toast('Welcome to the Story Club! 🌟'); }}>
            <input type="email" required placeholder="your@email.com" aria-label="Email" />
            <button className="btn">Subscribe</button>
          </form>
        </div>
      </section>
    </>
  );
}
