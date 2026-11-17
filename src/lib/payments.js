// Payment gateway abstraction.
// Today: Cash on Delivery + Bank Transfer work out of the box.
// When your gateway is approved, set VITE_PAYMENT_PROVIDER (payhere | stripe),
// add the server secrets in Vercel, and turn on "Online payment" in Admin → Settings.
import { config, isDemo } from './config';

export function paymentMethods(settings) {
  const m = [];
  if (config.paymentProvider !== 'none' && settings?.online_payment_enabled) {
    m.push({ id: 'online', icon: '💳', label: 'Card / online payment', hint: config.paymentProvider === 'payhere' ? 'Visa, Mastercard, Amex, eZ Cash, mCash via PayHere' : 'Secure card payment' });
  }
  if (settings?.cod_enabled !== false) m.push({ id: 'cod', icon: '💵', label: 'Cash on delivery', hint: 'Pay when your books arrive' });
  if (settings?.bank_transfer_enabled) m.push({ id: 'bank_transfer', icon: '🏦', label: 'Bank transfer', hint: 'We’ll ship once payment is confirmed' });
  if (m.length === 0) m.push({ id: 'cod', icon: '💵', label: 'Cash on delivery', hint: 'Pay when your books arrive' });
  return m;
}

/** Redirects the shopper to the gateway. Returns false if nothing to do. */
export async function startOnlinePayment(order) {
  if (isDemo) return false; // demo mode: no real gateway
  if (config.paymentProvider === 'payhere') {
    const res = await fetch('/api/payhere-checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: order.id }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not start payment');
    const { action, fields } = await res.json();
    // PayHere expects a classic form POST
    const form = document.createElement('form');
    form.method = 'POST'; form.action = action;
    Object.entries(fields).forEach(([k, v]) => {
      const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; form.appendChild(i);
    });
    document.body.appendChild(form); form.submit();
    return true;
  }
  if (config.paymentProvider === 'stripe') {
    const res = await fetch('/api/stripe-checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: order.id }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not start payment');
    const { url } = await res.json();
    window.location.href = url;
    return true;
  }
  return false;
}
