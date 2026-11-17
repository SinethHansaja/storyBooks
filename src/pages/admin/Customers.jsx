import { useMemo, useState } from 'react';
import { useAdmin } from './Admin';
import { fmtMoney, fmtDate, fmtDateTime, timeAgo } from '../../lib/format';
import { EVENT_LABELS } from '../../lib/analytics';
import { Modal, Spinner } from '../../components/ui';
import { downloadCSV } from './Orders';

export default function Customers() {
  const { customers, orders, events, loading } = useAdmin();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [sort, setSort] = useState('spent');

  const rows = useMemo(() => {
    // registered accounts + guest buyers (grouped by email)
    const map = new Map();
    customers.forEach((c) => map.set(c.email, { ...c, orders: [], events: [], guest: false }));
    orders.forEach((o) => {
      if (!map.has(o.email)) map.set(o.email, { id: o.user_id || o.email, email: o.email, name: o.name, role: 'guest', created_at: o.created_at, orders: [], events: [], guest: true });
      map.get(o.email).orders.push(o);
    });
    const byId = new Map([...map.values()].map((c) => [c.id, c]));
    events.forEach((e) => { if (e.user_id && byId.has(e.user_id)) byId.get(e.user_id).events.push(e); });
    return [...map.values()].map((c) => {
      const valid = c.orders.filter((o) => o.status !== 'cancelled');
      const spent = valid.reduce((a, o) => a + Number(o.total), 0);
      const last = [...c.events.map((e) => e.created_at), ...c.orders.map((o) => o.created_at)].sort().pop();
      return { ...c, spent, count: valid.length, last };
    });
  }, [customers, orders, events]);

  const list = useMemo(() => {
    const n = q.toLowerCase();
    return rows.filter((c) => !n || `${c.name} ${c.email}`.toLowerCase().includes(n))
      .sort((a, b) => sort === 'spent' ? b.spent - a.spent : sort === 'orders' ? b.count - a.count : sort === 'recent' ? String(b.last || '').localeCompare(String(a.last || '')) : String(b.created_at).localeCompare(String(a.created_at)));
  }, [rows, q, sort]);

  if (loading) return <Spinner />;
  const exportCsv = () => downloadCSV('customers.csv', list.map((c) => ({ name: c.name, email: c.email, type: c.guest ? 'guest' : c.role, joined: c.created_at, orders: c.count, spent: c.spent, last_seen: c.last || '' })));

  return (
    <>
      <div className="admin-top"><h1>🧑‍🤝‍🧑 Customers <small className="muted">({rows.length})</small></h1><button className="btn btn-ghost" onClick={exportCsv}>⬇️ Export CSV</button></div>
      <div className="card">
        <div className="toolbar">
          <input placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="spent">Top spenders</option><option value="orders">Most orders</option><option value="recent">Recently active</option><option value="new">Newest</option></select>
        </div>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Customer</th><th>Type</th><th>Joined</th><th>Orders</th><th>Total spent</th><th>Last seen</th></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.email} className="clickable" onClick={() => setOpen(c)}>
                  <td><b>{c.name}</b><br /><small className="muted">{c.email}</small></td>
                  <td><span className={`status ${c.role === 'admin' ? 's-shipped' : c.guest ? 's-pending' : 's-delivered'}`}>{c.guest ? 'guest' : c.role}</span></td>
                  <td>{fmtDate(c.created_at)}</td>
                  <td>{c.count}</td>
                  <td><b>{fmtMoney(c.spent)}</b></td>
                  <td className="muted">{c.last ? timeAgo(c.last) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.name || ''} wide>
        {open && (
          <div className="stack">
            <div className="kpis">
              <div className="kpi" data-icon="💰"><small>Lifetime spend</small><b>{fmtMoney(open.spent)}</b></div>
              <div className="kpi" data-icon="📦"><small>Orders</small><b>{open.count}</b></div>
              <div className="kpi" data-icon="🧺"><small>Avg. order</small><b>{fmtMoney(open.count ? open.spent / open.count : 0)}</b></div>
            </div>
            <dl className="kv"><dt>Email</dt><dd>{open.email}</dd><dt>Joined</dt><dd>{fmtDate(open.created_at)}</dd><dt>Account</dt><dd>{open.guest ? 'Guest checkout' : open.role}</dd></dl>
            <div className="detail-grid">
              <div className="card"><h4>Orders</h4>
                {open.orders.length ? <ul className="timeline">{[...open.orders].reverse().map((o) => <li key={o.id}><b>#{o.number}</b> · {fmtMoney(o.total)} · <span className={`status s-${o.status}`}>{o.status}</span><br /><small className="muted">{o.items.map((i) => i.title).join(', ')} — {fmtDate(o.created_at)}</small></li>)}</ul> : <p className="muted small">No orders yet</p>}
              </div>
              <div className="card"><h4>Activity trail</h4>
                {open.events.length ? <ul className="timeline">{[...open.events].reverse().slice(0, 80).map((e) => <li key={e.id}>{EVENT_LABELS[e.type]?.icon} {EVENT_LABELS[e.type]?.label || e.type} <b>{e.meta?.title || e.meta?.q || ''}</b><br /><small className="muted">{fmtDateTime(e.created_at)} · {e.device}</small></li>)}</ul> : <p className="muted small">Activity is tracked while signed in.</p>}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
