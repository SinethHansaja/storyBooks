import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../lib/state';
import { api } from '../lib/api';
import { track } from '../lib/analytics';
import { fmtMoney, fmtDate } from '../lib/format';
import { isDemo } from '../lib/config';
import { BookCard, Empty } from '../components/ui';

export function AuthForm({ adminHint = false, onDone }) {
  const { toast } = useStore();
  const [mode, setMode] = useState('in');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const u = mode === 'in' ? await api.auth.signIn(f) : await api.auth.signUp(f);
      track(mode === 'in' ? 'login' : 'signup');
      toast(`Welcome${mode === 'up' ? '' : ' back'}, ${u.name}! 🧚`);
      onDone?.(u);
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <form className="card auth" onSubmit={submit}>
      {!adminHint && (
        <div className="tabs">
          <button type="button" className={mode === 'in' ? 'on' : ''} onClick={() => setMode('in')}>Sign in</button>
          <button type="button" className={mode === 'up' ? 'on' : ''} onClick={() => setMode('up')}>Create account</button>
        </div>
      )}
      {mode === 'up' && <label>Your name<input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></label>}
      <label>Email<input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></label>
      <label>Password<input required type="password" minLength={6} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></label>
      {err && <p className="error">{err}</p>}
      <button className="btn btn-block" disabled={busy}>{busy ? '✨…' : mode === 'in' ? 'Sign in' : 'Create my account'}</button>
      {isDemo && <p className="muted small center">Demo admin: <code>admin@demo.com</code> / <code>admin123</code></p>}
    </form>
  );
}

export default function Account() {
  const { user, setUser, authReady, wishlist, byId, isAdmin } = useStore();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'orders';
  const nav = useNavigate();
  const [orders, setOrders] = useState([]);

  useEffect(() => { if (user) api.orders.mine(user.id).then(setOrders).catch(() => {}); }, [user]);

  if (!authReady) return null;
  const wishBooks = wishlist.map((id) => byId[id]).filter(Boolean);

  if (!user) {
    return (
      <div className="container section narrow">
        <h1 className="center">Welcome, little dreamer’s grown-up 🧚</h1>
        <p className="center muted">Sign in to track orders, save wishlists and check out faster.</p>
        <AuthForm onDone={(u) => { setUser(u); const next = params.get('next'); if (next) nav(next); else if (u.role === 'admin') nav('/admin'); }} />
        {wishBooks.length > 0 && (
          <section className="section"><h2>Your wishlist</h2><div className="grid">{wishBooks.map((b) => <BookCard key={b.id} book={b} />)}</div></section>
        )}
      </div>
    );
  }

  return (
    <div className="container section">
      <div className="account-head">
        <div><h1>Hello, {user.name} 👋</h1><p className="muted">{user.email}</p></div>
        <div className="row-gap">
          {isAdmin && <Link to="/admin" className="btn">Open admin ✨</Link>}
          <button className="btn btn-ghost" onClick={async () => { await api.auth.signOut(); setUser(null); nav('/'); }}>Sign out</button>
        </div>
      </div>
      <div className="tabs tabs-lg">
        <button className={tab === 'orders' ? 'on' : ''} onClick={() => setParams({ tab: 'orders' })}>📦 My orders ({orders.length})</button>
        <button className={tab === 'wishlist' ? 'on' : ''} onClick={() => setParams({ tab: 'wishlist' })}>💖 Wishlist ({wishBooks.length})</button>
      </div>
      {tab === 'orders' ? (
        orders.length === 0 ? <Empty icon="📦" title="No orders yet"><Link to="/shop" className="btn">Start your collection</Link></Empty> : (
          <div className="stack">
            {orders.map((o) => (
              <div className="card order-row" key={o.id}>
                <div><b>#{o.number}</b><small className="muted">{fmtDate(o.created_at)}</small></div>
                <div className="order-items">{o.items.map((i) => `${i.title} × ${i.qty}`).join(', ')}</div>
                <span className={`status s-${o.status}`}>{o.status}</span>
                <b>{fmtMoney(o.total)}</b>
                <Link to={`/order/${o.id}`} className="link">Details →</Link>
              </div>
            ))}
          </div>
        )
      ) : wishBooks.length === 0 ? <Empty icon="💖" title="Your wishlist is empty"><Link to="/shop" className="btn">Find favourites</Link></Empty> :
        <div className="grid">{wishBooks.map((b) => <BookCard key={b.id} book={b} />)}</div>}
    </div>
  );
}
