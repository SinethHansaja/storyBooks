// DEMO adapter — persists everything in the visitor's browser (localStorage).
// Perfect for previews; switch to Supabase (set env vars) for a real shop.
import { seedBooks, seedCoupons, seedSettings, seedHistory } from './seed';
import { uid } from './format';

const KEY = 'oup:db:v1';
const SESSION_KEY = 'oup:auth';
const MAX_EVENTS = 6000;
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('oup-live') : null;
const listeners = new Set();
const authListeners = new Set();

async function hash(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('oup:' + s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

let db = null;
function load() {
  if (db) return db;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
  if (!db) {
    const books = seedBooks();
    const hist = seedHistory(books);
    db = {
      books,
      coupons: seedCoupons(),
      settings: seedSettings(),
      orders: hist.orders,
      events: hist.events,
      users: [
        // demo admin — password: admin123 (hash filled in lazily below)
        { id: uid(), email: 'admin@demo.com', name: 'Store Admin', role: 'admin', pw: null, created_at: new Date().toISOString() },
        ...hist.customers.map((c) => ({ ...c, pw: null })),
      ],
      reviews: [],
    };
    save();
  }
  return db;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) {
    // quota: trim oldest events and retry once
    db.events = db.events.slice(-2000);
    localStorage.setItem(KEY, JSON.stringify(db));
  }
}
const clone = (x) => JSON.parse(JSON.stringify(x));
const publicUser = (u) => u && { id: u.id, email: u.email, name: u.name, role: u.role, created_at: u.created_at };

if (channel) channel.onmessage = (m) => {
  if (m.data?.kind === 'event') { db = null; listeners.forEach((fn) => fn(m.data.event)); }
  if (m.data?.kind === 'db') db = null;
};
const broadcast = () => channel?.postMessage({ kind: 'db' });

export const localStore = {
  mode: 'demo',

  auth: {
    async current() {
      const id = localStorage.getItem(SESSION_KEY);
      return publicUser(load().users.find((u) => u.id === id)) || null;
    },
    async signUp({ email, password, name }) {
      const d = load();
      email = email.trim().toLowerCase();
      if (d.users.some((u) => u.email === email)) throw new Error('An account with this email already exists.');
      const u = { id: uid(), email, name, role: 'customer', pw: await hash(password), created_at: new Date().toISOString() };
      d.users.push(u); save(); broadcast();
      localStorage.setItem(SESSION_KEY, u.id);
      authListeners.forEach((f) => f(publicUser(u)));
      return publicUser(u);
    },
    async signIn({ email, password }) {
      const d = load();
      email = email.trim().toLowerCase();
      const u = d.users.find((x) => x.email === email);
      if (!u) throw new Error('Wrong email or password.');
      if (u.email === 'admin@demo.com' && !u.pw) u.pw = await hash('admin123');
      if (!u.pw) u.pw = await hash('password'); // seeded demo customers
      if (u.pw !== (await hash(password))) throw new Error('Wrong email or password.');
      save();
      localStorage.setItem(SESSION_KEY, u.id);
      authListeners.forEach((f) => f(publicUser(u)));
      return publicUser(u);
    },
    async signOut() {
      localStorage.removeItem(SESSION_KEY);
      authListeners.forEach((f) => f(null));
    },
    onChange(fn) { authListeners.add(fn); return () => authListeners.delete(fn); },
  },

  books: {
    async list({ includeUnpublished = false } = {}) {
      return clone(load().books.filter((b) => includeUnpublished || b.published));
    },
    async get(idOrSlug) {
      return clone(load().books.find((b) => b.id === idOrSlug || b.slug === idOrSlug) || null);
    },
    async create(data) {
      const b = { ...data, id: uid(), created_at: new Date().toISOString(), rating_avg: 0, rating_count: 0 };
      load().books.unshift(b); save(); broadcast(); return clone(b);
    },
    async update(id, data) {
      const d = load(); const i = d.books.findIndex((b) => b.id === id);
      d.books[i] = { ...d.books[i], ...data }; save(); broadcast(); return clone(d.books[i]);
    },
    async remove(id) { const d = load(); d.books = d.books.filter((b) => b.id !== id); save(); broadcast(); },
    async uploadCover(file) {
      // Resize to keep localStorage small, return a data URL
      const img = await createImageBitmap(file);
      const scale = Math.min(1, 600 / img.width);
      const c = document.createElement('canvas');
      c.width = img.width * scale; c.height = img.height * scale;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.82);
    },
  },

  reviews: {
    async list(bookId) { return clone(load().reviews.filter((r) => r.book_id === bookId)); },
    async add({ book_id, rating, comment, name, user_id }) {
      const d = load();
      const r = { id: uid(), book_id, rating, comment, name, user_id, created_at: new Date().toISOString() };
      d.reviews.unshift(r);
      const b = d.books.find((x) => x.id === book_id);
      if (b) { b.rating_avg = (b.rating_avg * b.rating_count + rating) / (b.rating_count + 1); b.rating_count += 1; }
      save(); return clone(r);
    },
  },

  orders: {
    async create(order) {
      const d = load();
      // decrement stock (server-side trigger does this in Supabase mode)
      order.items.forEach((it) => {
        const b = d.books.find((x) => x.id === it.book_id);
        if (b && b.format !== 'eBook') b.stock = Math.max(0, b.stock - it.qty);
      });
      if (order.coupon_code) {
        const c = d.coupons.find((x) => x.code === order.coupon_code); if (c) c.uses += 1;
      }
      const o = { ...order, id: uid(), number: Math.max(1000, ...d.orders.map((x) => x.number)) + 1, created_at: new Date().toISOString() };
      d.orders.push(o); save(); broadcast(); return clone(o);
    },
    async list() { return clone([...load().orders].reverse()); },
    async mine(userId) { return clone(load().orders.filter((o) => o.user_id === userId).reverse()); },
    async get(id) { return clone(load().orders.find((o) => o.id === id) || null); },
    async update(id, data) {
      const d = load(); const o = d.orders.find((x) => x.id === id);
      Object.assign(o, data); save(); broadcast(); return clone(o);
    },
  },

  coupons: {
    async list() { return clone(load().coupons); },
    async validate(code) {
      const c = load().coupons.find((x) => x.code.toUpperCase() === code.trim().toUpperCase() && x.active);
      return c ? clone(c) : null;
    },
    async create(data) { const c = { ...data, id: uid(), uses: 0, created_at: new Date().toISOString() }; load().coupons.push(c); save(); return clone(c); },
    async update(id, data) { const c = load().coupons.find((x) => x.id === id); Object.assign(c, data); save(); return clone(c); },
    async remove(id) { const d = load(); d.coupons = d.coupons.filter((c) => c.id !== id); save(); },
  },

  settings: {
    async get() { return clone(load().settings); },
    async update(data) { const d = load(); d.settings = { ...d.settings, ...data }; save(); broadcast(); return clone(d.settings); },
  },

  customers: {
    async list() { return load().users.map(publicUser); },
  },

  events: {
    async track(e) {
      const d = load();
      const ev = { id: uid(), created_at: new Date().toISOString(), ...e };
      d.events.push(ev);
      if (d.events.length > MAX_EVENTS) d.events = d.events.slice(-MAX_EVENTS);
      save();
      listeners.forEach((fn) => fn(ev));
      channel?.postMessage({ kind: 'event', event: ev });
    },
    async list({ since } = {}) {
      const t = since ? new Date(since).getTime() : 0;
      return clone(load().events.filter((e) => new Date(e.created_at).getTime() >= t));
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  },

  async resetDemo() { localStorage.removeItem(KEY); localStorage.removeItem(SESSION_KEY); db = null; load(); broadcast(); },
};
