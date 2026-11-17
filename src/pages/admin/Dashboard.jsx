import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from './Admin';
import { LineChart, BarList, Donut, Funnel, Heatmap, SERIES } from './charts';
import { fmtMoney, fmtNum, timeAgo } from '../../lib/format';
import { EVENT_LABELS } from '../../lib/analytics';
import { Spinner, BookCover } from '../../components/ui';

const RANGES = { 1: 'Today', 7: '7 days', 30: '30 days', 90: '90 days' };
const DAY = 864e5;
const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

export function useNow(ms = 15000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

function metrics(orders, events, from, to) {
  const inR = (d) => { const t = new Date(d).getTime(); return t >= from && t < to; };
  const o = orders.filter((x) => x.status !== 'cancelled' && inR(x.created_at));
  const e = events.filter((x) => inR(x.created_at));
  const sessions = new Set(e.map((x) => x.session_id));
  const buyers = new Set(e.filter((x) => x.type === 'purchase').map((x) => x.session_id));
  const carts = new Set(e.filter((x) => x.type === 'add_to_cart').map((x) => x.session_id));
  const revenue = o.reduce((a, x) => a + Number(x.total), 0);
  return {
    revenue, orders: o.length, aov: o.length ? revenue / o.length : 0,
    visitors: sessions.size, pageviews: e.filter((x) => x.type === 'page_view' || x.type === 'view_book').length,
    conversion: sessions.size ? (buyers.size / sessions.size) * 100 : 0,
    abandonment: carts.size ? (1 - buyers.size / carts.size) * 100 : 0,
    o, e,
  };
}

function Delta({ cur, prev, invert }) {
  if (!prev || cur / prev > 20) return <span className="delta muted">no comparable data</span>;
  const d = ((cur - prev) / prev) * 100;
  const good = invert ? d <= 0 : d >= 0;
  return <span className={`delta ${good ? 'up' : 'down'}`}>{d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)}% vs prev.</span>;
}

export default function Dashboard() {
  const { orders, events, books, customers, loading } = useAdmin();
  const [range, setRange] = useState(30);
  const [metric, setMetric] = useState('revenue');
  const now = useNow();

  const data = useMemo(() => {
    const to = now;
    const from = range === 1 ? startOfDay(now) : startOfDay(now - (range - 1) * DAY);
    const span = to - from;
    const cur = metrics(orders, events, from, to);
    const prev = metrics(orders, events, from - span, from);

    // daily series (hourly for "today")
    const buckets = range === 1 ? 24 : range;
    const step = range === 1 ? 36e5 : DAY;
    const labels = [], rev = [], ord = [], vis = [];
    for (let i = 0; i < buckets; i++) {
      const a = from + i * step, b = a + step;
      labels.push(range === 1 ? `${i}:00` : new Date(a).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }));
      const os = cur.o.filter((x) => { const t = new Date(x.created_at).getTime(); return t >= a && t < b; });
      rev.push(os.reduce((s, x) => s + Number(x.total), 0));
      ord.push(os.length);
      vis.push(new Set(cur.e.filter((x) => { const t = new Date(x.created_at).getTime(); return t >= a && t < b; }).map((x) => x.session_id)).size);
    }

    const sessionsWith = (type) => new Set(cur.e.filter((x) => x.type === type).map((x) => x.session_id)).size;
    const funnel = [
      { label: 'Visited', value: cur.visitors },
      { label: 'Viewed a book', value: sessionsWith('view_book') },
      { label: 'Added to cart', value: sessionsWith('add_to_cart') },
      { label: 'Checkout', value: sessionsWith('begin_checkout') },
      { label: 'Purchased', value: sessionsWith('purchase') },
    ];

    const count = (arr, key) => {
      const m = {}; arr.forEach((x) => { const k = key(x); if (k) m[k] = (m[k] || 0) + 1; });
      return Object.entries(m).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    };
    const firstPerSession = {};
    cur.e.forEach((x) => { if (!firstPerSession[x.session_id]) firstPerSession[x.session_id] = x; });
    const sessionsList = Object.values(firstPerSession);

    const bookRev = {};
    cur.o.forEach((o) => o.items.forEach((i) => { bookRev[i.title] = (bookRev[i.title] || 0) + i.price * i.qty; }));
    const topSellers = Object.entries(bookRev).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);

    const heat = Array.from({ length: 7 }, () => Array(24).fill(0));
    cur.e.forEach((x) => { const d = new Date(x.created_at); heat[d.getDay()][d.getHours()]++; });

    return {
      cur, prev, labels, rev, ord, vis, funnel, topSellers, heat,
      sources: count(sessionsList, (x) => x.referrer || 'direct').slice(0, 6),
      devices: count(sessionsList, (x) => x.device || 'unknown'),
      viewed: count(cur.e.filter((x) => x.type === 'view_book'), (x) => x.meta?.title).slice(0, 6),
      searches: count(cur.e.filter((x) => x.type === 'search'), (x) => x.meta?.q?.toLowerCase()).slice(0, 8),
      newCustomers: customers.filter((c) => new Date(c.created_at).getTime() >= from).length,
    };
  }, [orders, events, customers, range, now]);

  const activeNow = useMemo(() => new Set(events.filter((e) => now - new Date(e.created_at).getTime() < 5 * 60e3).map((e) => e.session_id)).size, [events, now]);
  const feed = useMemo(() => [...events].slice(-12).reverse(), [events]);
  const lowStock = books.filter((b) => b.format !== 'eBook' && b.stock <= 5).sort((a, b) => a.stock - b.stock);
  const toFulfil = orders.filter((o) => o.status === 'pending' || o.status === 'processing');

  if (loading) return <Spinner />;
  const { cur, prev } = data;

  return (
    <>
      <div className="admin-top">
        <div><h1>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'} ✨</h1><span className="live-dot">{activeNow} visitor{activeNow === 1 ? '' : 's'} on the site right now</span></div>
        <div className="seg">{Object.entries(RANGES).map(([k, v]) => <button key={k} className={range === +k ? 'on' : ''} onClick={() => setRange(+k)}>{v}</button>)}</div>
      </div>

      <div className="kpis">
        <div className="kpi" data-icon="💰"><small>Revenue</small><b>{fmtMoney(cur.revenue)}</b><Delta cur={cur.revenue} prev={prev.revenue} /></div>
        <div className="kpi" data-icon="📦"><small>Orders</small><b>{fmtNum(cur.orders)}</b><Delta cur={cur.orders} prev={prev.orders} /></div>
        <div className="kpi" data-icon="👀"><small>Visitors</small><b>{fmtNum(cur.visitors)}</b><Delta cur={cur.visitors} prev={prev.visitors} /></div>
        <div className="kpi" data-icon="🎯"><small>Conversion</small><b>{cur.conversion.toFixed(2)}%</b><Delta cur={cur.conversion} prev={prev.conversion} /></div>
        <div className="kpi" data-icon="🧺"><small>Avg. order</small><b>{fmtMoney(cur.aov)}</b><Delta cur={cur.aov} prev={prev.aov} /></div>
        <div className="kpi" data-icon="📄"><small>Page views</small><b>{fmtNum(cur.pageviews)}</b><Delta cur={cur.pageviews} prev={prev.pageviews} /></div>
        <div className="kpi" data-icon="🛒"><small>Cart abandonment</small><b>{cur.abandonment.toFixed(1)}%</b><Delta cur={cur.abandonment} prev={prev.abandonment} invert /></div>
        <div className="kpi" data-icon="🌟"><small>New accounts</small><b>{fmtNum(data.newCustomers)}</b><span className="delta muted">in this period</span></div>
      </div>

      <div className="dash-grid">
        <div className="card col-8">
          <div className="card-head"><h3>Performance over time</h3>
            <div className="seg">{['revenue', 'orders', 'visitors'].map((m) => <button key={m} className={metric === m ? 'on' : ''} onClick={() => setMetric(m)}>{m[0].toUpperCase() + m.slice(1)}</button>)}</div>
          </div>
          <LineChart labels={data.labels}
            series={[
              { name: metric === 'revenue' ? 'Revenue' : metric === 'orders' ? 'Orders' : 'Visitors', values: metric === 'revenue' ? data.rev : metric === 'orders' ? data.ord : data.vis, color: SERIES[metric === 'revenue' ? 0 : metric === 'orders' ? 1 : 2] },
            ]}
            format={(v) => (metric === 'revenue' ? fmtMoney(v) : fmtNum(v))} />
        </div>
        <div className="card col-4">
          <div className="card-head"><h3>Live activity</h3><Link to="/admin/activity" className="link small">See all →</Link></div>
          <ul className="feed">
            {feed.map((e) => <FeedItem key={e.id} e={e} customers={customers} />)}
            {!feed.length && <p className="muted small">Waiting for the first visitor… ✨</p>}
          </ul>
        </div>

        <div className="card col-6"><div className="card-head"><h3>Conversion funnel</h3></div><Funnel steps={data.funnel} /></div>
        <div className="card col-6"><div className="card-head"><h3>Best sellers (revenue)</h3></div><BarList items={data.topSellers} format={fmtMoney} /></div>

        <div className="card col-4"><div className="card-head"><h3>Traffic sources</h3></div><BarList items={data.sources} colorIndex={2} /></div>
        <div className="card col-4"><div className="card-head"><h3>Devices</h3></div><Donut items={data.devices} /></div>
        <div className="card col-4"><div className="card-head"><h3>Most viewed books</h3></div><BarList items={data.viewed} colorIndex={1} /></div>

        <div className="card col-8"><div className="card-head"><h3>When families shop</h3><small className="muted">activity by weekday & hour</small></div><Heatmap grid={data.heat} /></div>
        <div className="card col-4"><div className="card-head"><h3>Top searches</h3></div><BarList items={data.searches} colorIndex={3} empty="No searches in this period" /></div>

        <div className="card col-6">
          <div className="card-head"><h3>Orders to fulfil</h3><Link to="/admin/orders" className="link small">Manage →</Link></div>
          {toFulfil.length === 0 ? <p className="muted small">All caught up! 🎉</p> : (
            <div className="table-wrap"><table className="tbl"><tbody>
              {toFulfil.slice(0, 6).map((o) => (
                <tr key={o.id}><td><b>#{o.number}</b></td><td>{o.name}</td><td><span className={`status s-${o.status}`}>{o.status}</span></td><td>{fmtMoney(o.total)}</td><td className="muted">{timeAgo(o.created_at)}</td></tr>
              ))}
            </tbody></table></div>
          )}
        </div>
        <div className="card col-6">
          <div className="card-head"><h3>Low stock alerts</h3><Link to="/admin/books" className="link small">Restock →</Link></div>
          {lowStock.length === 0 ? <p className="muted small">Shelves are full 📚</p> : (
            <div className="table-wrap"><table className="tbl"><tbody>
              {lowStock.slice(0, 6).map((b) => (
                <tr key={b.id}><td className="thumb"><BookCover book={b} /></td><td>{b.title}</td><td><span className={`status ${b.stock === 0 ? 's-cancelled' : 's-pending'}`}>{b.stock === 0 ? 'Sold out' : `${b.stock} left`}</span></td></tr>
              ))}
            </tbody></table></div>
          )}
        </div>
      </div>
    </>
  );
}

export function FeedItem({ e, customers, isNew }) {
  const lbl = EVENT_LABELS[e.type] || { icon: '•', label: e.type };
  const who = customers?.find((c) => c.id === e.user_id)?.name || `Guest ${String(e.session_id).slice(0, 4)}`;
  const detail = e.meta?.title || e.meta?.q || (e.meta?.total ? fmtMoney(e.meta.total) : '') || e.path;
  return (
    <li className={isNew ? 'new' : ''}>
      <span className="feed-icon">{lbl.icon}</span>
      <span><b>{who}</b> {lbl.label}<br /><small>{detail} · {e.device} · {e.referrer}</small></span>
      <small>{timeAgo(e.created_at)}</small>
    </li>
  );
}
