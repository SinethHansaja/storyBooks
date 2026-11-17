import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/state';
import { api } from '../lib/api';
import { track } from '../lib/analytics';
import { fmtMoney, fmtDate, ageLabel } from '../lib/format';
import { BookCard, BookCover, Empty, Spinner, Stars } from '../components/ui';

export default function BookDetail() {
  const { slug } = useParams();
  const { books, booksLoading, addToCart, wishlist, toggleWish, user, toast, refreshBooks } = useStore();
  const nav = useNavigate();
  const book = books.find((b) => b.slug === slug || b.id === slug);
  const [qty, setQty] = useState(1);
  const [open, setOpen] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [form, setForm] = useState({ rating: 5, comment: '' });

  useEffect(() => {
    if (!book) return;
    setQty(1); setOpen(false);
    track('view_book', { book_id: book.id, meta: { title: book.title } });
    api.reviews.list(book.id).then(setReviews).catch(() => {});
    document.title = `${book.title} — Once Upon a Page`;
    return () => { document.title = 'Once Upon a Page — Magical Storybooks for Little Dreamers'; };
  }, [book?.id]); // eslint-disable-line

  const related = useMemo(() => book ? books.filter((b) => b.id !== book.id && (b.category === book.category || b.author === book.author)).slice(0, 4) : [], [books, book]);

  if (booksLoading) return <div className="container section"><Spinner /></div>;
  if (!book) return <div className="container section"><Empty icon="🧭" title="This book wandered off"><Link className="btn" to="/shop">Back to the library</Link></Empty></div>;

  const soldOut = book.format !== 'eBook' && book.stock <= 0;
  const maxQty = book.format === 'eBook' ? 1 : book.stock;
  const wished = wishlist.includes(book.id);

  const submitReview = async (e) => {
    e.preventDefault();
    if (!user) return nav('/account');
    const r = await api.reviews.add({ book_id: book.id, rating: Number(form.rating), comment: form.comment, name: user.name, user_id: user.id });
    setReviews([r, ...reviews]); setForm({ rating: 5, comment: '' });
    toast('Thank you for your review! 🌟'); refreshBooks();
  };
  const share = async () => {
    const data = { title: book.title, url: location.href };
    if (navigator.share) navigator.share(data).catch(() => {});
    else { await navigator.clipboard.writeText(location.href); toast('Link copied 🔗'); }
  };

  return (
    <div className="container section">
      <nav className="crumbs"><Link to="/">Home</Link> / <Link to="/shop">Books</Link> / <Link to={`/shop?cat=${encodeURIComponent(book.category)}`}>{book.category}</Link></nav>
      <div className="pdp">
        <div className="pdp-visual">
          <button className={`big-book ${open ? 'open' : ''}`} onClick={() => setOpen(!open)} aria-label="Open the book">
            <div className="big-book-inner">
              <div className="big-page"><p>Once upon a time…</p><span>{book.emoji}</span><small>Tap to close</small></div>
              <div className="big-cover"><BookCover book={book} /></div>
            </div>
          </button>
          <small className="muted center">Tap the book to peek inside ✨</small>
        </div>

        <div className="pdp-info">
          <div className="chips"><span className="chip chip-age">Ages {ageLabel(book)}</span><span className="chip">{book.category}</span><span className="chip">{book.format}</span></div>
          <h1>{book.title}</h1>
          <p className="muted">by <b>{book.author}</b>{book.illustrator && book.illustrator !== book.author && <> · illustrated by <b>{book.illustrator}</b></>}</p>
          <Stars value={book.rating_avg} count={book.rating_count} size={18} />
          <div className="pdp-price">
            {fmtMoney(book.price)}
            {book.compare_at_price > book.price && <><s>{fmtMoney(book.compare_at_price)}</s><span className="save">Save {Math.round((1 - book.price / book.compare_at_price) * 100)}%</span></>}
          </div>
          <p className="pdp-desc">{book.description}</p>
          <div className="stock-line">
            {soldOut ? <span className="dot dot-red">Sold out — check back soon</span>
              : book.format === 'eBook' ? <span className="dot dot-green">Instant digital delivery</span>
              : book.stock <= 5 ? <span className="dot dot-amber">Hurry, only {book.stock} left!</span>
              : <span className="dot dot-green">In stock · ships in 1–2 days</span>}
          </div>
          <div className="pdp-buy">
            {book.format !== 'eBook' && (
              <div className="qty qty-lg">
                <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Decrease">−</button>
                <span>{qty}</span>
                <button onClick={() => setQty(Math.min(maxQty, qty + 1))} aria-label="Increase">+</button>
              </div>
            )}
            <button className="btn btn-lg" disabled={soldOut} onClick={() => addToCart(book, qty)}>Add to basket 🧺</button>
            <button className="btn btn-lg btn-alt" disabled={soldOut} onClick={() => { addToCart(book, qty); nav('/checkout'); }}>Buy now</button>
          </div>
          <div className="pdp-secondary">
            <button className="link-btn" onClick={() => toggleWish(book)}>{wished ? '💖 In your wishlist' : '🤍 Add to wishlist'}</button>
            <button className="link-btn" onClick={share}>🔗 Share</button>
          </div>
          <dl className="specs">
            <div><dt>Pages</dt><dd>{book.pages}</dd></div>
            <div><dt>Format</dt><dd>{book.format}</dd></div>
            <div><dt>Age range</dt><dd>{ageLabel(book)}</dd></div>
            <div><dt>Category</dt><dd>{book.category}</dd></div>
          </dl>
          {book.tags?.length > 0 && <div className="chips">{book.tags.map((t) => <Link key={t} to={`/shop?q=${encodeURIComponent(t)}`} className="chip chip-tag">#{t}</Link>)}</div>}
        </div>
      </div>

      <section className="section reviews">
        <h2>What families are saying</h2>
        <div className="reviews-grid">
          <form className="card review-form" onSubmit={submitReview}>
            <h4>Write a review</h4>
            <div className="rate-pick">
              {[1, 2, 3, 4, 5].map((n) => (
                <button type="button" key={n} className={n <= form.rating ? 'on' : ''} onClick={() => setForm({ ...form, rating: n })} aria-label={`${n} stars`}>★</button>
              ))}
            </div>
            <textarea required rows={3} placeholder="What did your little one love?" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
            <button className="btn">{user ? 'Post review' : 'Sign in to review'}</button>
          </form>
          <div className="review-list">
            {reviews.length === 0 ? <p className="muted">No written reviews yet — be the first! ✍️</p> :
              reviews.map((r) => (
                <div key={r.id} className="card review">
                  <div className="review-top"><b>{r.name}</b><Stars value={r.rating} /></div>
                  <p>{r.comment}</p><small className="muted">{fmtDate(r.created_at)}</small>
                </div>
              ))}
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>You might also love</h2></div>
          <div className="grid">{related.map((b) => <BookCard key={b.id} book={b} />)}</div>
        </section>
      )}
    </div>
  );
}
