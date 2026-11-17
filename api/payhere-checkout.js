// POST /api/payhere-checkout  { order_id }
// Builds the signed PayHere checkout form for an order. The amount always
// comes from the database (never from the browser).
import crypto from 'node:crypto';
import { env, getOrder, readBody } from './_lib.js';

const md5 = (s) => crypto.createHash('md5').update(s).digest('hex').toUpperCase();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { order_id } = await readBody(req);
    const order = await getOrder(order_id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.payment_status === 'paid') return res.status(400).json({ error: 'Order already paid' });

    const merchantId = env('PAYHERE_MERCHANT_ID');
    const secret = env('PAYHERE_MERCHANT_SECRET');
    const site = env('SITE_URL').replace(/\/$/, '');
    const currency = process.env.VITE_CURRENCY || 'LKR';
    const amount = Number(order.total).toFixed(2);
    const hash = md5(merchantId + order.id + amount + currency + md5(secret));
    const [first, ...rest] = String(order.name).split(' ');
    const sandbox = (process.env.VITE_PAYHERE_SANDBOX ?? 'true') !== 'false';

    res.status(200).json({
      action: sandbox ? 'https://sandbox.payhere.lk/pay/checkout' : 'https://www.payhere.lk/pay/checkout',
      fields: {
        merchant_id: merchantId,
        return_url: `${site}/order/${order.id}`,
        cancel_url: `${site}/order/${order.id}?cancelled=1`,
        notify_url: `${site}/api/payhere-notify`,
        order_id: order.id,
        items: `Order #${order.number}`,
        currency,
        amount,
        first_name: first || 'Customer',
        last_name: rest.join(' ') || '-',
        email: order.email,
        phone: order.phone || '',
        address: order.address?.line1 || 'N/A',
        city: order.address?.city || 'N/A',
        country: order.address?.country || 'Sri Lanka',
        hash,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
