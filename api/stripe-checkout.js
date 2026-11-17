// POST /api/stripe-checkout { order_id } — creates a Stripe Checkout Session.
// (Only needed if you choose Stripe instead of PayHere.)
import { env, getOrder, readBody } from './_lib.js';

const ZERO_DECIMAL = ['JPY', 'KRW', 'VND'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { order_id } = await readBody(req);
    const order = await getOrder(order_id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const site = env('SITE_URL').replace(/\/$/, '');
    const currency = (process.env.VITE_CURRENCY || 'LKR').toUpperCase();
    const unit = ZERO_DECIMAL.includes(currency) ? Math.round(order.total) : Math.round(order.total * 100);

    const form = new URLSearchParams({
      mode: 'payment',
      success_url: `${site}/order/${order.id}`,
      cancel_url: `${site}/order/${order.id}?cancelled=1`,
      customer_email: order.email,
      client_reference_id: order.id,
      'metadata[order_id]': order.id,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(unit),
      'line_items[0][price_data][product_data][name]': `Order #${order.number}`,
    });
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    const data = await r.json();
    if (!r.ok) return res.status(400).json({ error: data.error?.message || 'Stripe error' });
    res.status(200).json({ url: data.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
