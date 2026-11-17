// First-party activity tracking. Every interesting thing a visitor does is
// recorded as an "event" that powers the admin dashboard.
import { api } from './api';

const SID_KEY = 'oup:sid';
const SID_TTL = 30 * 60 * 1000; // a session ends after 30 min idle

function sessionId() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(SID_KEY) || 'null');
    if (raw && Date.now() - raw.t < SID_TTL) {
      raw.t = Date.now(); sessionStorage.setItem(SID_KEY, JSON.stringify(raw)); return raw.id;
    }
  } catch { /* ignore */ }
  const id = (crypto.randomUUID?.() || Math.random().toString(36).slice(2)) ;
  sessionStorage.setItem(SID_KEY, JSON.stringify({ id, t: Date.now() }));
  return id;
}

function device() {
  const w = window.innerWidth;
  return w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
}

function referrerSource() {
  const fromUtm = new URLSearchParams(location.search).get('utm_source');
  if (fromUtm) return fromUtm.toLowerCase();
  const r = document.referrer;
  if (!r) return 'direct';
  try {
    const h = new URL(r).hostname;
    if (h === location.hostname) return 'internal';
    if (h.includes('google')) return 'google';
    if (h.includes('facebook') || h.includes('fb.')) return 'facebook';
    if (h.includes('instagram')) return 'instagram';
    if (h.includes('tiktok')) return 'tiktok';
    if (h.includes('whatsapp')) return 'whatsapp';
    return h.replace(/^www\./, '');
  } catch { return 'other'; }
}

const currentPath = () => window.__oupPath || location.pathname;

let firstRef = null;
let currentUserId = null;
export const setAnalyticsUser = (id) => { currentUserId = id || null; };

export function track(type, { book_id = null, meta = {} } = {}) {
  if (currentPath().startsWith('/admin')) return; // don't pollute stats with admin activity
  if (!firstRef) firstRef = referrerSource();
  api.events.track({
    type,
    session_id: sessionId(),
    user_id: currentUserId,
    path: currentPath(),
    book_id,
    meta,
    device: device(),
    referrer: firstRef,
  }).catch(() => {});
}

export const EVENT_LABELS = {
  page_view: { icon: '👀', label: 'viewed a page' },
  view_book: { icon: '📖', label: 'opened a book' },
  search: { icon: '🔎', label: 'searched' },
  add_to_cart: { icon: '🛒', label: 'added to cart' },
  remove_from_cart: { icon: '🗑️', label: 'removed from cart' },
  add_to_wishlist: { icon: '💖', label: 'wishlisted' },
  begin_checkout: { icon: '💳', label: 'started checkout' },
  purchase: { icon: '🎉', label: 'placed an order' },
  signup: { icon: '🌟', label: 'created an account' },
  login: { icon: '🔑', label: 'signed in' },
  apply_coupon: { icon: '🎟️', label: 'applied a coupon' },
};
