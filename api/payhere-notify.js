// POST /api/payhere-notify — PayHere server-to-server callback.
// Verifies the md5sig and marks the order paid / failed.
import crypto from 'node:crypto';
import { env, getOrder, readBody, updateOrder } from './_lib.js';

const md5 = (s) => crypto.createHash('md5').update(s).digest('hex').toUpperCase();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const b = await readBody(req);
    const expected = md5(
      env('PAYHERE_MERCHANT_ID') + b.order_id + b.payhere_amount + b.payhere_currency + b.status_code + md5(env('PAYHERE_MERCHANT_SECRET')),
    );
    if (expected !== b.md5sig) return res.status(400).send('bad signature');

    const order = await getOrder(b.order_id);
    if (!order) return res.status(404).send('no order');
    if (Number(b.payhere_amount).toFixed(2) !== Number(order.total).toFixed(2)) return res.status(400).send('amount mismatch');

    const code = String(b.status_code); // 2 success, 0 pending, -1 cancelled, -2 failed, -3 chargeback
    const payment_status = code === '2' ? 'paid' : code === '0' ? 'pending' : code === '-3' ? 'refunded' : 'failed';
    await updateOrder(order.id, {
      payment_status,
      payment_ref: b.payment_id || null,
      ...(code === '2' && order.status === 'pending' ? { status: 'processing' } : {}),
    });
    res.status(200).send('ok');
  } catch (e) {
    res.status(500).send(e.message);
  }
}
