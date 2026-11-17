// POST /api/stripe-webhook — marks orders paid when Stripe confirms payment.
// In Stripe Dashboard → Developers → Webhooks, add:
//   https://YOUR-DOMAIN/api/stripe-webhook   event: checkout.session.completed
// and put the signing secret in STRIPE_WEBHOOK_SECRET.
import crypto from 'node:crypto';
import { env, updateOrder } from './_lib.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const chunks = []; for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8');
    const sig = Object.fromEntries(String(req.headers['stripe-signature'] || '').split(',').map((p) => p.split('=')));
    const expected = crypto.createHmac('sha256', env('STRIPE_WEBHOOK_SECRET')).update(`${sig.t}.${raw}`).digest('hex');
    const ok = sig.v1 && sig.v1.length === expected.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig.v1));
    if (!ok || Math.abs(Date.now() / 1000 - Number(sig.t)) > 300) return res.status(400).send('bad signature');

    const event = JSON.parse(raw);
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      if (s.payment_status === 'paid') {
        await updateOrder(s.metadata.order_id, { payment_status: 'paid', payment_ref: s.payment_intent, status: 'processing' });
      }
    }
    res.status(200).json({ received: true });
  } catch (e) {
    res.status(500).send(e.message);
  }
}
