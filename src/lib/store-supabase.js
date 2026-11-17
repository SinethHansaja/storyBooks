// PRODUCTION adapter — Supabase (Postgres + Auth + Storage + Realtime).
// Schema, security policies and triggers live in /supabase/schema.sql
import { createClient } from '@supabase/supabase-js';
import { config } from './config';

const sb = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

async function profileFor(user) {
  if (!user) return null;
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return {
    id: user.id,
    email: user.email,
    name: data?.name || user.user_metadata?.name || user.email.split('@')[0],
    role: data?.role || 'customer',
    created_at: user.created_at,
  };
}

/** Supabase returns max 1000 rows per request — page through. */
async function fetchAll(build, cap = 50000) {
  const out = []; const size = 1000;
  for (let from = 0; from < cap; from += size) {
    const rows = must(await build().range(from, from + size - 1));
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

export const supabaseStore = {
  mode: 'supabase',
  client: sb,

  auth: {
    async current() { const { data } = await sb.auth.getUser(); return profileFor(data.user); },
    async signUp({ email, password, name }) {
      const data = must(await sb.auth.signUp({ email, password, options: { data: { name } } }));
      if (!data.session) throw new Error('Almost there! Please check your inbox and confirm your email, then sign in.');
      return profileFor(data.user);
    },
    async signIn({ email, password }) {
      const data = must(await sb.auth.signInWithPassword({ email, password }));
      return profileFor(data.user);
    },
    async signOut() { await sb.auth.signOut(); },
    onChange(fn) {
      const { data } = sb.auth.onAuthStateChange(async (_e, session) => fn(await profileFor(session?.user)));
      return () => data.subscription.unsubscribe();
    },
  },

  books: {
    async list({ includeUnpublished = false } = {}) {
      let q = sb.from('books').select('*').order('created_at', { ascending: false });
      if (!includeUnpublished) q = q.eq('published', true);
      return must(await q);
    },
    async get(idOrSlug) {
      const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
      return must(await sb.from('books').select('*').eq(isUuid ? 'id' : 'slug', idOrSlug).maybeSingle());
    },
    async create(data) { return must(await sb.from('books').insert(data).select().single()); },
    async update(id, data) { return must(await sb.from('books').update(data).eq('id', id).select().single()); },
    async remove(id) { must(await sb.from('books').delete().eq('id', id)); },
    async uploadCover(file) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `covers/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      must(await sb.storage.from('book-covers').upload(path, file, { cacheControl: '31536000', upsert: false }));
      return sb.storage.from('book-covers').getPublicUrl(path).data.publicUrl;
    },
  },

  reviews: {
    async list(bookId) { return must(await sb.from('reviews').select('*').eq('book_id', bookId).order('created_at', { ascending: false })); },
    async add(r) { return must(await sb.from('reviews').insert(r).select().single()); },
  },

  orders: {
    // place_order is a SECURITY DEFINER function: it re-prices items from the
    // books table, applies coupons/shipping and decrements stock server-side,
    // so totals can't be tampered with in the browser.
    async create(order) { return must(await sb.rpc('place_order', { payload: order })); },
    async list() { return fetchAll(() => sb.from('orders').select('*').order('created_at', { ascending: false })); },
    async mine(userId) { return must(await sb.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false })); },
    async get(id) { return must(await sb.rpc('get_order', { order_id: id })); },
    async update(id, data) { return must(await sb.from('orders').update(data).eq('id', id).select().single()); },
  },

  coupons: {
    async list() { return must(await sb.from('coupons').select('*').order('created_at')); },
    async validate(code) { return must(await sb.rpc('validate_coupon', { coupon_code: code.trim() })); },
    async create(data) { return must(await sb.from('coupons').insert(data).select().single()); },
    async update(id, data) { return must(await sb.from('coupons').update(data).eq('id', id).select().single()); },
    async remove(id) { must(await sb.from('coupons').delete().eq('id', id)); },
  },

  settings: {
    async get() { return must(await sb.from('settings').select('data').eq('id', 1).single()).data; },
    async update(data) {
      const cur = await this.get();
      return must(await sb.from('settings').update({ data: { ...cur, ...data } }).eq('id', 1).select('data').single()).data;
    },
  },

  customers: {
    async list() { return fetchAll(() => sb.from('profiles').select('*').order('created_at', { ascending: false })); },
  },

  events: {
    async track(e) { await sb.from('events').insert(e); }, // fire & forget; errors ignored
    async list({ since } = {}) {
      return fetchAll(() => {
        let q = sb.from('events').select('*').order('created_at', { ascending: true });
        if (since) q = q.gte('created_at', new Date(since).toISOString());
        return q;
      });
    },
    subscribe(fn) {
      const ch = sb.channel('events-live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, (p) => fn(p.new))
        .subscribe();
      return () => sb.removeChannel(ch);
    },
  },
};
