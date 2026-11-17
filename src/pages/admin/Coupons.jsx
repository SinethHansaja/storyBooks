import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useStore } from '../../lib/state';
import { fmtMoney } from '../../lib/format';
import { Spinner } from '../../components/ui';

export default function Coupons() {
  const { toast } = useStore();
  const [list, setList] = useState(null);
  const [f, setF] = useState({ code: '', type: 'percent', value: 10, min_subtotal: 0 });
  const load = () => api.coupons.list().then(setList);
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    try {
      await api.coupons.create({ ...f, code: f.code.trim().toUpperCase(), value: Number(f.value), min_subtotal: Number(f.min_subtotal), active: true });
      toast('Coupon created 🎟️'); setF({ ...f, code: '' }); load();
    } catch (err) { toast(err.message, 'warn'); }
  };
  if (!list) return <Spinner />;
  return (
    <>
      <div className="admin-top"><h1>🎟️ Coupons</h1></div>
      <div className="dash-grid">
        <form className="card col-4 stack" onSubmit={add} style={{ alignContent: 'start' }}>
          <h3>New coupon</h3>
          <label>Code<input required value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="BIRTHDAY15" /></label>
          <label>Type<select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="percent">Percentage off</option><option value="fixed">Fixed amount off</option></select></label>
          <label>{f.type === 'percent' ? 'Percent (%)' : 'Amount'}<input type="number" min="1" max={f.type === 'percent' ? 100 : undefined} required value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></label>
          <label>Minimum order<input type="number" min="0" value={f.min_subtotal} onChange={(e) => setF({ ...f, min_subtotal: e.target.value })} /></label>
          <button className="btn">Create coupon</button>
        </form>
        <div className="card col-8 table-wrap">
          <table className="tbl">
            <thead><tr><th>Code</th><th>Discount</th><th>Min. order</th><th>Uses</th><th>Active</th><th /></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td><code>{c.code}</code></td>
                  <td>{c.type === 'percent' ? `${c.value}%` : fmtMoney(c.value)}</td>
                  <td>{c.min_subtotal ? fmtMoney(c.min_subtotal) : '—'}</td>
                  <td>{c.uses}</td>
                  <td><label className="switch"><input type="checkbox" checked={c.active} onChange={async (e) => { await api.coupons.update(c.id, { active: e.target.checked }); load(); }} /><span /></label></td>
                  <td><button className="icon-btn" aria-label="Delete" onClick={async () => { if (confirm(`Delete ${c.code}?`)) { await api.coupons.remove(c.id); load(); } }}>🗑️</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.length && <p className="muted center">No coupons yet.</p>}
        </div>
      </div>
    </>
  );
}
