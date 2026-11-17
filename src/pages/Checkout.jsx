import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useStore, priceSummary } from '../lib/state';
import { api } from '../lib/api';
import { track } from '../lib/analytics';
import { fmtMoney, fmtDateTime } from '../lib/format';
import { paymentMethods, startOnlinePayment } from '../lib/payments';
import { isDemo } from '../lib/config';
import { BookCover, Empty, Spinner } from '../components/ui';

function useCoupon(subtotal, initial = null) {
  const { toast } = useStore();
  const [coupon, setCoupon] = useState(initial);
  const [code, setCode] = useState(initial?.code || '');
  const apply = async (e) => {
    e?.preventDefault();
    if (!code.trim()) return;
    const c = await api.coupons.validate(code);
    if (!c) return toast('That code doesn’t seem magical 🤔', 'warn');
    if (subtotal < Number(c.min_subtotal || 0)) return toast(`This code needs a minimum of ${fmtMoney(c.min_subtotal)}`, 'warn');
    setCoupon(c); track('apply_coupon', { meta: { code: c.code } }); toast(`Code ${c.code} applied 🎟️`);
  };
  return { coupon, code, setCode, apply, clear: () => { setCoupon(null); setCode(''); } };
}

function Summary({ lines, s, couponUI, compact }) {
  return (
    <div className="card summary">
      <h3>Order summary</h3>
      <ul className="sum-lines">
        {lines.map((l) => (
          <li key={l.book_id}><BookCover book={l.book} className="sum-cover" /><span>{l.book.title}<small>× {l.qty}</small></span><b>{fmtMoney(l.qty * l.book.price)}</b></li>
        ))}
      </ul>
      {couponUI && !compact && (
        couponUI.coupon ? (
          <div className="coupon-on">🎟️ <b>{couponUI.coupon.code}</b> applied <button type="button" className="link-btn" onClick={couponUI.clear}>remove</button></div>
        ) : (
          <div className="coupon">
            <input value={couponUI.code} onChange={(e) => couponUI.setCode(e.target.value.toUpperCase())} placeholder="Gift or promo code" onKeyDown={(e) => e.key === 'Enter' && couponUI.apply(e)} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={couponUI.apply}>Apply</button>
          </div>
        )
      )}
      <div className="row"><span>Subtotal</span><span>{fmtMoney(s.subtotal)}</span></div>
      {s.discount > 0 && <div className="row discount"><span>Discount</span><span>− {fmtMoney(s.discount)}</span></div>}
      <div className="row"><span>Delivery</span><span>{s.shipping ? fmtMoney(s.shipping) : 'Free'}</span></div>
      <div className="row total"><span>Total</span><b>{fmtMoney(s.total)}</b></div>
    </div>
  );
}

export function Cart() {
  const { cart, setQty, removeFromCart, subtotal, settings } = useStore();
  const nav = useNavigate();
  const couponUI = useCoupon(subtotal);
  const needsShipping = cart.some((l) => l.book.format !== 'eBook');
  const s = priceSummary(subtotal, settings, couponUI.coupon, needsShipping);
  if (!cart.length) return <div className="container section"><Empty icon="🧺" title="Your basket is empty"><Link className="btn" to="/shop">Find a story</Link></Empty></div>;
  return (
    <div className="container section">
      <h1>Your Story Basket</h1>
      <div className="checkout-grid">
        <div className="card">
          <ul className="cart-table">
            {cart.map((l) => (
              <li key={l.book_id}>
                <BookCover book={l.book} className="line-cover" />
                <div><Link to={`/book/${l.book.slug}`} className="line-title">{l.book.title}</Link><small className="muted">{l.book.author} · {l.book.format}</small></div>
                <div className="qty"><button onClick={() => setQty(l.book_id, l.qty - 1)}>−</button><span>{l.qty}</span><button onClick={() => setQty(l.book_id, l.qty + 1)}>+</button></div>
                <b>{fmtMoney(l.qty * l.book.price)}</b>
                <button className="icon-btn" onClick={() => removeFromCart(l.book_id)} aria-label="Remove">🗑️</button>
              </li>
            ))}
          </ul>
          <Link to="/shop" className="link">← Keep exploring</Link>
        </div>
        <div>
          <Summary lines={[]} s={s} couponUI={couponUI} />
          <button className="btn btn-lg btn-block" onClick={() => nav('/checkout', { state: { coupon: couponUI.coupon } })}>Proceed to checkout ✨</button>
        </div>
      </div>
    </div>
  );
}

export function Checkout() {
  const { cart, subtotal, settings, user, clearCart, refreshBooks, toast } = useStore();
  const nav = useNavigate();
  const loc = useLocation();
  const couponUI = useCoupon(subtotal, loc.state?.coupon || null);
  const methods = paymentMethods(settings);
  const [pay, setPay] = useState(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: user?.name || '', email: user?.email || '', phone: '', line1: '', city: '', postal: '', country: 'Sri Lanka', notes: '', gift: false });
  const started = useRef(false);

  useEffect(() => { if (cart.length && !started.current) { started.current = true; track('begin_checkout', { meta: { items: cart.length, subtotal } }); } }, [cart.length]); // eslint-disable-line
  useEffect(() => { if (user) setF((x) => ({ ...x, name: x.name || user.name, email: x.email || user.email })); }, [user]);
  useEffect(() => { if (!pay && methods.length) setPay(methods[0].id); }, [methods.length]); // eslint-disable-line

  const needsShipping = cart.some((l) => l.book.format !== 'eBook');
  const s = priceSummary(subtotal, settings, couponUI.coupon, needsShipping);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  if (!cart.length) return <div className="container section"><Empty icon="🧺" title="Nothing to check out yet"><Link className="btn" to="/shop">Browse books</Link></Empty></div>;

  const placeOrder = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const order = await api.orders.create({
        user_id: user?.id || null,
        email: f.email.trim().toLowerCase(), name: f.name.trim(), phone: f.phone.trim(),
        address: needsShipping ? { line1: f.line1, city: f.city, postal: f.postal, country: f.country } : null,
        items: cart.map((l) => ({ book_id: l.book_id, title: l.book.title, price: Number(l.book.price), qty: l.qty })),
        subtotal: s.subtotal, discount: s.discount, shipping: s.shipping, total: s.total,
        coupon_code: couponUI.coupon?.code || null,
        payment_method: pay, payment_status: 'pending', status: 'pending',
        notes: (f.gift ? '🎁 Gift wrap requested. ' : '') + f.notes,
      });
      track('purchase', { meta: { order_id: order.id, number: order.number, total: order.total } });
      clearCart(); refreshBooks();
      if (pay === 'online') {
        const redirected = await startOnlinePayment(order);
        if (redirected) return;
      }
      nav(`/order/${order.id}`, { state: { order } });
    } catch (err) {
      toast(err.message || 'Something went wrong — please try again', 'warn');
    } finally { setBusy(false); }
  };

  return (
    <div className="container section">
      <h1>Checkout</h1>
      {!user && <p className="muted">Have an account? <Link to="/account?next=/checkout" className="link">Sign in</Link> for faster checkout — or continue as a guest.</p>}
      <form className="checkout-grid" onSubmit={placeOrder}>
        <div className="stack">
          <fieldset className="card">
            <legend>1 · Your details</legend>
            <div className="form-grid">
              <label>Full name<input required value={f.name} onChange={up('name')} autoComplete="name" /></label>
              <label>Email<input required type="email" value={f.email} onChange={up('email')} autoComplete="email" /></label>
              <label>Phone<input required value={f.phone} onChange={up('phone')} autoComplete="tel" placeholder="+94 7X XXX XXXX" /></label>
            </div>
          </fieldset>
          {needsShipping && (
            <fieldset className="card">
              <legend>2 · Delivery address</legend>
              <div className="form-grid">
                <label className="span-2">Address<input required value={f.line1} onChange={up('line1')} autoComplete="street-address" /></label>
                <label>City<input required value={f.city} onChange={up('city')} autoComplete="address-level2" /></label>
                <label>Postal code<input value={f.postal} onChange={up('postal')} autoComplete="postal-code" /></label>
                <label className="span-2">Country<input required value={f.country} onChange={up('country')} autoComplete="country-name" /></label>
                <label className="check span-2"><input type="checkbox" checked={f.gift} onChange={up('gift')} /> 🎁 Gift wrap this order (free)</label>
                <label className="span-2">Notes / gift message<textarea rows={2} value={f.notes} onChange={up('notes')} placeholder="Happy 5th birthday, Mia! 🎂" /></label>
              </div>
            </fieldset>
          )}
          <fieldset className="card">
            <legend>{needsShipping ? 3 : 2} · Payment</legend>
            <div className="pay-options">
              {methods.map((m) => (
                <label key={m.id} className={`pay-option ${pay === m.id ? 'on' : ''}`}>
                  <input type="radio" name="pay" checked={pay === m.id} onChange={() => setPay(m.id)} />
                  <span className="pay-icon">{m.icon}</span>
                  <span><b>{m.label}</b><small>{m.hint}</small></span>
                </label>
              ))}
            </div>
            {pay === 'bank_transfer' && <pre className="bank">{settings?.bank_details}</pre>}
            {isDemo && <p className="muted small">Demo mode: no real payment is taken.</p>}
          </fieldset>
        </div>
        <div>
          <Summary lines={cart} s={s} couponUI={couponUI} />
          <button className="btn btn-lg btn-block" disabled={busy}>{busy ? 'Casting spell…' : `Place order · ${fmtMoney(s.total)}`}</button>
          <p className="muted small center">🔒 Your details are safe with us.</p>
        </div>
      </form>
    </div>
  );
}

export function OrderSuccess() {
  const { id } = useParams();
  const { settings, toast } = useStore();
  const cancelled = new URLSearchParams(useLocation().search).get('cancelled');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.orders.get(id).then(setOrder).finally(() => setLoading(false)); }, [id]);
  if (loading) return <div className="container section"><Spinner /></div>;
  if (!order) return <div className="container section"><Empty icon="📭" title="Order not found"><Link to="/" className="btn">Home</Link></Empty></div>;
  return (
    <div className="container section success">
      <div className="confetti" aria-hidden="true">{Array.from({ length: 30 }).map((_, i) => <i key={i} style={{ left: `${(i * 31) % 100}%`, animationDelay: `${(i % 10) * 0.15}s` }} />)}</div>
      <div className="card success-card">
        <div className="success-icon">🎉</div>
        <h1>Hooray! Your order is on its way to the castle</h1>
        <p>Order <b>#{order.number}</b> · placed {fmtDateTime(order.created_at)}</p>
        <p className="muted">A confirmation will be sent to <b>{order.email}</b>.</p>
        {order.payment_method === 'bank_transfer' && order.payment_status !== 'paid' && (
          <div className="notice"><b>Next step:</b> please transfer <b>{fmtMoney(order.total)}</b> using the details below and include <b>#{order.number}</b> as the reference.<pre className="bank">{settings?.bank_details}</pre></div>
        )}
        {order.payment_method === 'online' && order.payment_status !== 'paid' && (
          <div className="notice">{cancelled ? 'Your card payment was cancelled — no money was taken.' : 'We’re waiting for confirmation from the payment provider.'}
            <br /><button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => startOnlinePayment(order).catch((e) => toast(e.message, 'warn'))}>Pay now 💳</button>
          </div>
        )}
        {order.payment_method === 'online' && order.payment_status === 'paid' && <div className="notice">💳 Payment received — thank you!</div>}
        {order.payment_method === 'cod' && <div className="notice">💵 Please keep <b>{fmtMoney(order.total)}</b> ready for the delivery hero.</div>}
        <ul className="sum-lines">{order.items.map((i) => <li key={i.book_id}><span>{i.title}<small>× {i.qty}</small></span><b>{fmtMoney(i.price * i.qty)}</b></li>)}</ul>
        <div className="row total"><span>Total</span><b>{fmtMoney(order.total)}</b></div>
        <div className="hero-cta center"><Link to="/shop" className="btn">Continue exploring</Link><Link to="/account" className="btn btn-ghost">My orders</Link></div>
      </div>
    </div>
  );
}
