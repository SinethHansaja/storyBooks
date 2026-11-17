import { useMemo, useState } from 'react';
import { useAdmin } from './Admin';
import { useStore } from '../../lib/state';
import { api } from '../../lib/api';
import { ORDER_STATUSES, PAYMENT_STATUSES } from '../../lib/config';
import { fmtMoney, fmtDateTime } from '../../lib/format';
import { Modal, Spinner } from '../../components/ui';

export function downloadCSV(name, rows) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = name; a.click();
}

const PAY_LABEL = { cod: 'Cash on delivery', bank_transfer: 'Bank transfer', online: 'Online' };
const PAGE = 25;

function OrderDetail({ order, onChange }) {
  const { toast } = useStore();
  const set = async (patch) => { const o = await api.orders.update(order.id, patch); onChange(o); toast('Order updated'); };
  return (
    <div className="stack">
      <div className="row-gap">
        <label>Order status<select value={order.status} onChange={(e) => set({ status: e.target.value })}>{ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>Payment<select value={order.payment_status} onChange={(e) => set({ payment_status: e.target.value })}>{PAYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
      </div>
      <div className="detail-grid">
        <div className="card"><h4>Customer</h4><dl className="kv"><dt>Name</dt><dd>{order.name}</dd><dt>Email</dt><dd><a className="link" href={`mailto:${order.email}`}>{order.email}</a></dd><dt>Phone</dt><dd><a className="link" href={`tel:${order.phone}`}>{order.phone}</a></dd></dl></div>
        <div className="card"><h4>Delivery</h4>{order.address ? <p>{order.address.line1}<br />{order.address.city} {order.address.postal}<br />{order.address.country}</p> : <p className="muted">Digital order — no shipping</p>}</div>
      </div>
      <div className="card">
        <h4>Items</h4>
        <table className="tbl"><tbody>
          {order.items.map((i) => <tr key={i.book_id}><td>{i.title}</td><td>× {i.qty}</td><td>{fmtMoney(i.price * i.qty)}</td></tr>)}
          <tr><td>Subtotal</td><td /><td>{fmtMoney(order.subtotal)}</td></tr>
          {Number(order.discount) > 0 && <tr><td>Discount {order.coupon_code && <code>{order.coupon_code}</code>}</td><td /><td className="up">− {fmtMoney(order.discount)}</td></tr>}
          <tr><td>Delivery</td><td /><td>{fmtMoney(order.shipping)}</td></tr>
          <tr><td><b>Total</b></td><td /><td><b>{fmtMoney(order.total)}</b></td></tr>
        </tbody></table>
      </div>
      {order.notes && <div className="notice"><b>Notes:</b> {order.notes}</div>}
      <small className="muted">Placed {fmtDateTime(order.created_at)} · {PAY_LABEL[order.payment_method] || order.payment_method}{order.payment_ref ? ` · ref ${order.payment_ref}` : ''}</small>
      <button className="btn btn-ghost" onClick={() => window.print()}>🖨️ Print packing slip</button>
    </div>
  );
}

export default function Orders() {
  const { orders, loading, setData } = useAdmin();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [pay, setPay] = useState('');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(null);

  const list = useMemo(() => {
    const n = q.toLowerCase();
    return orders.filter((o) => (!status || o.status === status) && (!pay || o.payment_status === pay)
      && (!n || `${o.number} ${o.name} ${o.email} ${o.phone}`.toLowerCase().includes(n)));
  }, [orders, q, status, pay]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const view = list.slice(page * PAGE, page * PAGE + PAGE);
  const counts = useMemo(() => Object.fromEntries(ORDER_STATUSES.map((s) => [s, orders.filter((o) => o.status === s).length])), [orders]);

  const exportCsv = () => downloadCSV(`orders-${new Date().toISOString().slice(0, 10)}.csv`, list.map((o) => ({
    number: o.number, date: o.created_at, name: o.name, email: o.email, phone: o.phone,
    city: o.address?.city || '', items: o.items.map((i) => `${i.title} x${i.qty}`).join('; '),
    subtotal: o.subtotal, discount: o.discount, shipping: o.shipping, total: o.total,
    payment_method: o.payment_method, payment_status: o.payment_status, status: o.status, notes: o.notes,
  })));

  const onChange = (o) => { setOpen(o); setData((d) => ({ ...d, orders: d.orders.map((x) => (x.id === o.id ? o : x)) })); };

  if (loading) return <Spinner />;
  return (
    <>
      <div className="admin-top"><h1>📦 Orders <small className="muted">({orders.length})</small></h1><button className="btn btn-ghost" onClick={exportCsv}>⬇️ Export CSV</button></div>
      <div className="seg" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <button className={!status ? 'on' : ''} onClick={() => { setStatus(''); setPage(0); }}>All</button>
        {ORDER_STATUSES.map((s) => <button key={s} className={status === s ? 'on' : ''} onClick={() => { setStatus(s); setPage(0); }}>{s} ({counts[s]})</button>)}
      </div>
      <div className="card">
        <div className="toolbar">
          <input placeholder="Search # / name / email / phone" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
          <select value={pay} onChange={(e) => { setPay(e.target.value); setPage(0); }}><option value="">Any payment</option>{PAYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        </div>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead>
            <tbody>
              {view.map((o) => (
                <tr key={o.id} className="clickable" onClick={() => setOpen(o)}>
                  <td><b>#{o.number}</b></td>
                  <td>{fmtDateTime(o.created_at)}</td>
                  <td>{o.name}<br /><small className="muted">{o.address?.city || 'Digital'}</small></td>
                  <td>{o.items.reduce((a, i) => a + i.qty, 0)}</td>
                  <td><b>{fmtMoney(o.total)}</b></td>
                  <td><span className={`status s-${o.payment_status}`}>{o.payment_status}</span><br /><small className="muted">{PAY_LABEL[o.payment_method]}</small></td>
                  <td><span className={`status s-${o.status}`}>{o.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!view.length && <p className="muted center">No orders match.</p>}
        </div>
        <div className="pager">
          <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>←</button>
          Page {page + 1} / {pages}
          <button className="btn btn-ghost btn-sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>→</button>
        </div>
      </div>
      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `Order #${open.number}` : ''} wide>
        {open && <OrderDetail order={open} onChange={onChange} />}
      </Modal>
    </>
  );
}
