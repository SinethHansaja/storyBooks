import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../../lib/state';
import { api } from '../../lib/api';
import { isDemo } from '../../lib/config';
import { AuthForm } from '../Account';
import { Spinner } from '../../components/ui';
import Dashboard from './Dashboard';
import Books from './Books';
import Orders from './Orders';
import Customers from './Customers';
import Activity from './Activity';
import Coupons from './Coupons';
import Settings from './Settings';

const AdminCtx = createContext(null);
export const useAdmin = () => useContext(AdminCtx);

function AdminData({ children }) {
  const [data, setData] = useState({ orders: [], events: [], customers: [], books: [], loading: true });
  const load = useCallback(async () => {
    const since = Date.now() - 180 * 864e5;
    const [orders, events, customers, books] = await Promise.all([
      api.orders.list(), api.events.list({ since }), api.customers.list(), api.books.list({ includeUnpublished: true }),
    ]);
    setData({ orders, events, customers, books, loading: false });
  }, []);
  useEffect(() => { load(); }, [load]);
  // live: append new events as they happen; refresh orders when a purchase lands
  useEffect(() => api.events.subscribe((ev) => {
    setData((d) => ({ ...d, events: d.events.some((e) => e.id === ev.id) ? d.events : [...d.events, ev] }));
    if (ev.type === 'purchase') api.orders.list().then((orders) => setData((d) => ({ ...d, orders })));
  }), []);
  return <AdminCtx.Provider value={{ ...data, reload: load, setData }}>{children}</AdminCtx.Provider>;
}

const LINKS = [
  ['', '📊', 'Dashboard'],
  ['activity', '⚡', 'Live activity'],
  ['orders', '📦', 'Orders'],
  ['books', '📚', 'Books'],
  ['customers', '🧑‍🤝‍🧑', 'Customers'],
  ['coupons', '🎟️', 'Coupons'],
  ['settings', '⚙️', 'Settings'],
];

export default function Admin() {
  const { user, setUser, authReady, isAdmin, settings } = useStore();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => { document.title = 'Admin — ' + (settings?.store_name || 'Once Upon a Page'); }, [settings]);

  if (!authReady) return <Spinner />;
  if (!user || !isAdmin) {
    return (
      <div className="admin-login">
        <div>
          <h1 className="center">✨ Admin castle</h1>
          {user && !isAdmin && <p className="error">Signed in as {user.email}, which isn’t an admin account.</p>}
          <AuthForm adminHint onDone={(u) => { setUser(u); if (u.role !== 'admin') nav('/admin'); }} />
          {!isDemo && <p className="muted small center">Make an account an admin in Supabase — see README → “Create your admin”.</p>}
          <Link to="/" className="link center">← Back to the shop</Link>
        </div>
      </div>
    );
  }

  return (
    <AdminData>
      <div className="admin">
        <aside className={`admin-side ${open ? 'open' : ''}`}>
          <Link to="/" className="logo"><span className="logo-mark">📖</span><span className="logo-text">Admin</span></Link>
          {LINKS.map(([to, i, l]) => <NavLink key={to} to={`/admin${to ? '/' + to : ''}`} end={!to}><span>{i}</span>{l}</NavLink>)}
          <div className="spacer" />
          {isDemo && <button className="side-link" onClick={async () => { if (confirm('Reset all demo data?')) { await api.resetDemo(); nav('/'); location.reload(); } }}>🔄 Reset demo data</button>}
          <Link to="/">🏰 View shop</Link>
          <button className="side-link" onClick={async () => { await api.auth.signOut(); setUser(null); nav('/'); }}>🚪 Sign out</button>
        </aside>
        <div className="admin-main">
          <button className="icon-btn admin-burger" onClick={() => setOpen(!open)} aria-label="Menu" style={{ marginBottom: 12 }}>☰</button>
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="activity" element={<Activity />} />
            <Route path="orders" element={<Orders />} />
            <Route path="books" element={<Books />} />
            <Route path="customers" element={<Customers />} />
            <Route path="coupons" element={<Coupons />} />
            <Route path="settings" element={<Settings />} />
          </Routes>
        </div>
      </div>
    </AdminData>
  );
}
