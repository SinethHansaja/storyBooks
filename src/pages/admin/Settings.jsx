import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useStore } from '../../lib/state';
import { config, isDemo } from '../../lib/config';
import { Spinner } from '../../components/ui';

export default function Settings() {
  const { settings, refreshSettings, toast } = useStore();
  const [f, setF] = useState(null);
  useEffect(() => { if (settings) setF(settings); }, [settings]);
  if (!f) return <Spinner />;
  const up = (k, num) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : num ? Number(e.target.value) : e.target.value });
  const save = async (e) => { e.preventDefault(); await api.settings.update(f); await refreshSettings(); toast('Settings saved ✨'); };
  const gatewayReady = config.paymentProvider !== 'none';

  return (
    <form onSubmit={save}>
      <div className="admin-top"><h1>⚙️ Settings</h1><button className="btn">Save settings</button></div>
      <div className="dash-grid">
        <div className="card col-6 stack">
          <h3>Store</h3>
          <label>Store name<input value={f.store_name} onChange={up('store_name')} /></label>
          <label>Tagline<input value={f.tagline} onChange={up('tagline')} /></label>
          <label>Announcement bar <small className="muted">(leave empty to hide)</small><input value={f.announcement} onChange={up('announcement')} /></label>
          <label>Contact email<input type="email" value={f.contact_email} onChange={up('contact_email')} /></label>
          <label>Contact phone<input value={f.contact_phone} onChange={up('contact_phone')} /></label>
        </div>
        <div className="card col-6 stack">
          <h3>Delivery</h3>
          <label>Flat delivery fee<input type="number" min="0" value={f.shipping_flat} onChange={up('shipping_flat', true)} /></label>
          <label>Free delivery over <small className="muted">(0 = never)</small><input type="number" min="0" value={f.free_shipping_over} onChange={up('free_shipping_over', true)} /></label>
          <h3 style={{ marginTop: 10 }}>Payments</h3>
          <div className="switch-row"><span>💵 Cash on delivery</span><label className="switch"><input type="checkbox" checked={f.cod_enabled} onChange={up('cod_enabled')} /><span /></label></div>
          <div className="switch-row"><span>🏦 Bank transfer</span><label className="switch"><input type="checkbox" checked={f.bank_transfer_enabled} onChange={up('bank_transfer_enabled')} /><span /></label></div>
          {f.bank_transfer_enabled && <label>Bank details shown to customers<textarea rows={4} value={f.bank_details} onChange={up('bank_details')} /></label>}
          <div className="switch-row">
            <span>💳 Online card payment<br /><small className="muted">{gatewayReady ? `Provider: ${config.paymentProvider}${config.paymentProvider === 'payhere' && config.payhereSandbox ? ' (sandbox)' : ''}` : 'Gateway not configured yet — see README → Payments'}</small></span>
            <label className="switch"><input type="checkbox" disabled={!gatewayReady} checked={!!f.online_payment_enabled && gatewayReady} onChange={up('online_payment_enabled')} /><span /></label>
          </div>
        </div>
        <div className="card col-12">
          <h3>System</h3>
          <dl className="kv">
            <dt>Data mode</dt><dd>{isDemo ? '🟡 Demo (browser storage only — connect Supabase before launch)' : '🟢 Supabase (live database)'}</dd>
            <dt>Currency</dt><dd>{config.currency} ({config.locale})</dd>
            <dt>Payment provider</dt><dd>{config.paymentProvider}</dd>
          </dl>
        </div>
      </div>
    </form>
  );
}
