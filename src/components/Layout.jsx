import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useStore, priceSummary } from '../lib/state';
import { fmtMoney } from '../lib/format';
import { track } from '../lib/analytics';
import { isDemo } from '../lib/config';
import { BookCover, Toasts, SparkleTrail, Sky, Empty } from './ui';

function Header() {
  const { cartCount, setCartOpen, user, isAdmin, wishlist, settings } = useStore();
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => setMenu(false), [loc.pathname]);
  const submit = (e) => { e.preventDefault(); if (q.trim()) nav(`/shop?q=${encodeURIComponent(q.trim())}`); };
  return (
    <>
      {settings?.announcement && <div className="announce">{settings.announcement}</div>}
      <header className="header">
        <div className="container header-in">
          <Link to="/" className="logo" aria-label="Home">
            <span className="logo-mark">📖</span>
            <span className="logo-text">{settings?.store_name || 'Once Upon a Page'}</span>
          </Link>
          <nav className={`nav ${menu ? 'open' : ''}`}>
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/shop">All Books</NavLink>
            <NavLink to="/shop?cat=Bedtime%20Stories">Bedtime</NavLink>
            <NavLink to="/shop?cat=Fairy%20Tales">Fairy Tales</NavLink>
            <NavLink to="/about">Our Story</NavLink>
            {isAdmin && <NavLink to="/admin" className="nav-admin">✨ Admin</NavLink>}
          </nav>
          <form className="search" onSubmit={submit} role="search">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a magical story…" aria-label="Search books" />
            <button aria-label="Search">🔎</button>
          </form>
          <div className="header-actions">
            <Link to="/account?tab=wishlist" className="icon-btn wish-link" aria-label="Wishlist">💖{wishlist.length > 0 && <b className="badge">{wishlist.length}</b>}</Link>
            <Link to="/account" className="icon-btn" aria-label="Account">{user ? '🧚' : '👤'}</Link>
            <button className="icon-btn cart-btn" onClick={() => setCartOpen(true)} aria-label="Open basket">
              🧺{cartCount > 0 && <b className="badge bump" key={cartCount}>{cartCount}</b>}
            </button>
            <button className="icon-btn burger" onClick={() => setMenu(!menu)} aria-label="Menu">☰</button>
          </div>
        </div>
      </header>
    </>
  );
}

function CartDrawer() {
  const { cart, cartOpen, setCartOpen, setQty, removeFromCart, subtotal, settings } = useStore();
  const nav = useNavigate();
  const needsShipping = cart.some((l) => l.book.format !== 'eBook');
  const s = priceSummary(subtotal, settings, null, needsShipping);
  const freeOver = Number(settings?.free_shipping_over || 0);
  const pct = freeOver ? Math.min(100, (subtotal / freeOver) * 100) : 100;
  return (
    <>
      <div className={`drawer-back ${cartOpen ? 'show' : ''}`} onClick={() => setCartOpen(false)} />
      <aside className={`drawer ${cartOpen ? 'open' : ''}`} aria-hidden={!cartOpen} aria-label="Basket">
        <header className="drawer-head">
          <h3>Your Story Basket 🧺</h3>
          <button className="icon-btn" onClick={() => setCartOpen(false)} aria-label="Close basket">✕</button>
        </header>
        {cart.length === 0 ? (
          <Empty icon="🧺" title="Your basket is empty">
            <p>Every great adventure starts with a single book.</p>
            <button className="btn" onClick={() => { setCartOpen(false); nav('/shop'); }}>Explore books</button>
          </Empty>
        ) : (
          <>
            {needsShipping && freeOver > 0 && (
              <div className="ship-meter">
                <div className="ship-bar"><span style={{ width: `${pct}%` }} /></div>
                <small>{subtotal >= freeOver ? '🎉 You unlocked FREE delivery!' : `Add ${fmtMoney(freeOver - subtotal)} more for free delivery`}</small>
              </div>
            )}
            <ul className="drawer-items">
              {cart.map((l) => (
                <li key={l.book_id} className="line">
                  <BookCover book={l.book} className="line-cover" />
                  <div className="line-info">
                    <Link to={`/book/${l.book.slug}`} onClick={() => setCartOpen(false)} className="line-title">{l.book.title}</Link>
                    <small>{l.book.format}</small>
                    <div className="qty">
                      <button onClick={() => setQty(l.book_id, l.qty - 1)} aria-label="Decrease">−</button>
                      <span>{l.qty}</span>
                      <button onClick={() => setQty(l.book_id, l.qty + 1)} aria-label="Increase">+</button>
                    </div>
                  </div>
                  <div className="line-end">
                    <b>{fmtMoney(l.qty * l.book.price)}</b>
                    <button className="link-btn" onClick={() => removeFromCart(l.book_id)}>Remove</button>
                  </div>
                </li>
              ))}
            </ul>
            <footer className="drawer-foot">
              <div className="row"><span>Subtotal</span><b>{fmtMoney(s.subtotal)}</b></div>
              <div className="row muted"><span>Delivery</span><span>{s.shipping ? fmtMoney(s.shipping) : 'Free'}</span></div>
              <button className="btn btn-block btn-lg" onClick={() => { setCartOpen(false); nav('/checkout'); }}>Checkout ✨ {fmtMoney(s.total)}</button>
              <Link to="/cart" className="link-btn center" onClick={() => setCartOpen(false)}>View full basket</Link>
            </footer>
          </>
        )}
      </aside>
    </>
  );
}

function Footer() {
  const { settings } = useStore();
  return (
    <footer className="footer">
      <div className="footer-wave" aria-hidden="true" />
      <div className="container footer-grid">
        <div>
          <div className="logo"><span className="logo-mark">📖</span><span className="logo-text">{settings?.store_name || 'Once Upon a Page'}</span></div>
          <p>{settings?.tagline}. Hand-picked stories that spark imagination, kindness and a lifelong love of reading.</p>
        </div>
        <div>
          <h4>Explore</h4>
          <Link to="/shop">All books</Link>
          <Link to="/shop?age=0-2">Babies & toddlers</Link>
          <Link to="/shop?age=6-8">Early readers</Link>
          <Link to="/shop?sort=new">New arrivals</Link>
        </div>
        <div>
          <h4>Help</h4>
          <Link to="/about#faq">FAQ</Link>
          <Link to="/about#shipping">Delivery & returns</Link>
          <Link to="/account">My orders</Link>
        </div>
        <div>
          <h4>Say hello</h4>
          <a href={`mailto:${settings?.contact_email}`}>{settings?.contact_email}</a>
          <a href={`tel:${settings?.contact_phone}`}>{settings?.contact_phone}</a>
        </div>
      </div>
      <div className="container footer-bottom">© {new Date().getFullYear()} {settings?.store_name}. Made with 💖 and a sprinkle of fairy dust.</div>
    </footer>
  );
}

export default function Layout() {
  const loc = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (!loc.pathname.startsWith('/book/')) track('page_view');
  }, [loc.pathname]);
  return (
    <div className="app">
      <Sky />
      <SparkleTrail />
      {isDemo && <div className="demo-flag" title="Data is stored only in this browser. Connect Supabase for a live shop.">Demo mode</div>}
      <Header />
      <main><Outlet /></main>
      <Footer />
      <CartDrawer />
      <Toasts />
    </div>
  );
}
