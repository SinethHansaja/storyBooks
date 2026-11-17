import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { PALETTES } from '../lib/config';
import { fmtMoney, ageLabel } from '../lib/format';
import { useStore } from '../lib/state';

export function BookCover({ book, className = '' }) {
  if (book.cover_url) return <img className={`cover ${className}`} src={book.cover_url} alt={`Cover of ${book.title}`} loading="lazy" />;
  const [a, b, ink] = PALETTES[(book.palette ?? 0) % PALETTES.length];
  return (
    <div className={`cover cover-gen ${className}`} style={{ '--ca': a, '--cb': b, '--ink': ink }} role="img" aria-label={`Cover of ${book.title}`}>
      <span className="cover-emoji">{book.emoji || '📖'}</span>
      <span className="cover-title">{book.title}</span>
      <span className="cover-author">{book.author}</span>
    </div>
  );
}

export function Stars({ value = 0, count, size = 14 }) {
  return (
    <span className="stars" style={{ fontSize: size }} aria-label={`${Number(value).toFixed(1)} out of 5`}>
      <span className="stars-bg">★★★★★</span>
      <span className="stars-fg" style={{ width: `${(value / 5) * 100}%` }}>★★★★★</span>
      {count != null && <span className="stars-count">({count})</span>}
    </span>
  );
}

export function BookCard({ book }) {
  const { addToCart, wishlist, toggleWish } = useStore();
  const ref = useRef(null);
  const soldOut = book.format !== 'eBook' && book.stock <= 0;
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.setProperty('--rx', `${-y * 12}deg`);
    ref.current.style.setProperty('--ry', `${x * 16}deg`);
  };
  const reset = () => { ref.current.style.setProperty('--rx', '0deg'); ref.current.style.setProperty('--ry', '0deg'); };
  const wished = wishlist.includes(book.id);
  return (
    <article className="book-card">
      <Link to={`/book/${book.slug}`} className="book-3d-wrap" ref={ref} onMouseMove={onMove} onMouseLeave={reset}>
        <div className="book-3d">
          <BookCover book={book} />
          <span className="book-pages" />
        </div>
        {book.compare_at_price > book.price && <span className="ribbon">Sale</span>}
        {soldOut && <span className="ribbon ribbon-grey">Sold out</span>}
        {!soldOut && book.format !== 'eBook' && book.stock > 0 && book.stock <= 5 && <span className="ribbon ribbon-gold">Only {book.stock} left</span>}
      </Link>
      <button className={`wish ${wished ? 'on' : ''}`} onClick={() => toggleWish(book)} aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}>
        {wished ? '💖' : '🤍'}
      </button>
      <div className="book-meta">
        <div className="chips"><span className="chip chip-age">{ageLabel(book)}</span><span className="chip">{book.format}</span></div>
        <Link to={`/book/${book.slug}`} className="book-title">{book.title}</Link>
        <div className="book-author">by {book.author}</div>
        <Stars value={book.rating_avg} count={book.rating_count} />
        <div className="book-buy">
          <span className="price">
            {fmtMoney(book.price)}
            {book.compare_at_price > book.price && <s>{fmtMoney(book.compare_at_price)}</s>}
          </span>
          <button className="btn btn-sm" disabled={soldOut} onClick={() => addToCart(book)}>{soldOut ? 'Sold out' : 'Add 🛒'}</button>
        </div>
      </div>
    </article>
  );
}

export function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => <div key={t.id} className={`toast toast-${t.kind}`}>{t.msg}</div>)}
    </div>
  );
}

/** Magic sparkle trail that follows the pointer (desktop, motion allowed). */
export function SparkleTrail() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.matchMedia('(pointer: coarse)').matches) return;
    let last = 0;
    const glyphs = ['✦', '✧', '⋆', '✩', '·'];
    const colors = ['#f7a8cb', '#b9a6ff', '#9fd8ff', '#ffd36e', '#a6e8c2'];
    const onMove = (e) => {
      const now = performance.now();
      if (now - last < 45) return;
      last = now;
      const s = document.createElement('span');
      s.className = 'sparkle';
      s.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
      s.style.left = e.clientX + 'px';
      s.style.top = e.clientY + 'px';
      s.style.color = colors[Math.floor(Math.random() * colors.length)];
      s.style.setProperty('--dx', `${(Math.random() - 0.5) * 40}px`);
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 900);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);
  return null;
}

/** Decorative CSS clouds & stars floating behind page content. */
export function Sky() {
  return (
    <div className="sky" aria-hidden="true">
      <span className="cloud c1" /><span className="cloud c2" /><span className="cloud c3" />
      {Array.from({ length: 14 }).map((_, i) => (
        <span key={i} className="twinkle" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 90}%`, animationDelay: `${(i % 7) * 0.5}s` }}>✦</span>
      ))}
    </div>
  );
}

export function Empty({ icon = '🌙', title, children }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function Spinner() { return <div className="spinner" aria-label="Loading">✨</div>; }

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Close">✕</button></header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
