// Single entry point for data. Picks Supabase when configured, otherwise the
// browser-only demo store. The Supabase adapter is loaded lazily so the demo
// bundle stays small.
import { isDemo } from './config';
import { localStore } from './store-local';

let impl = localStore;
let ready = Promise.resolve(localStore);

if (!isDemo) {
  ready = import('./store-supabase').then((m) => (impl = m.supabaseStore));
}

export const whenReady = () => ready;

// Proxy so callers can write api.books.list() without awaiting the import.
const section = (name) => new Proxy({}, {
  get: (_t, fn) => async (...args) => { await ready; return impl[name][fn](...args); },
});

export const api = {
  get mode() { return impl.mode; },
  auth: {
    current: async () => { await ready; return impl.auth.current(); },
    signUp: async (a) => { await ready; return impl.auth.signUp(a); },
    signIn: async (a) => { await ready; return impl.auth.signIn(a); },
    signOut: async () => { await ready; return impl.auth.signOut(); },
    onChange: (fn) => { let off = () => {}; ready.then(() => { off = impl.auth.onChange(fn); }); return () => off(); },
  },
  books: section('books'),
  reviews: section('reviews'),
  orders: section('orders'),
  coupons: section('coupons'),
  settings: section('settings'),
  customers: section('customers'),
  events: {
    track: async (e) => { await ready; return impl.events.track(e); },
    list: async (o) => { await ready; return impl.events.list(o); },
    subscribe: (fn) => { let off = () => {}; ready.then(() => { off = impl.events.subscribe(fn); }); return () => off(); },
  },
  resetDemo: () => localStore.resetDemo(),
};
