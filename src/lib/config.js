const env = import.meta.env;

export const config = {
  supabaseUrl: env.VITE_SUPABASE_URL || '',
  // publishable key (sb_publishable_...) — legacy anon key also accepted
  supabaseAnonKey: env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '',
  currency: env.VITE_CURRENCY || 'LKR',
  locale: env.VITE_LOCALE || 'en-LK',
  paymentProvider: env.VITE_PAYMENT_PROVIDER || 'none', // none | payhere | stripe
  payhereSandbox: (env.VITE_PAYHERE_SANDBOX ?? 'true') !== 'false',
};

export const isDemo = !(config.supabaseUrl && config.supabaseAnonKey);

export const CATEGORIES = [
  'Fairy Tales', 'Bedtime Stories', 'Adventure', 'Animals', 'Picture Books',
  'Early Learning', 'Fantasy', 'Friendship', 'Rhymes & Poems',
];

export const AGE_GROUPS = [
  { label: '0–2 yrs', min: 0, max: 2 },
  { label: '3–5 yrs', min: 3, max: 5 },
  { label: '6–8 yrs', min: 6, max: 8 },
  { label: '9–12 yrs', min: 9, max: 12 },
];

export const FORMATS = ['Hardcover', 'Paperback', 'Board Book', 'eBook'];

export const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

/** Pastel cover palettes [background-a, background-b, ink] */
export const PALETTES = [
  ['#ffd6e8', '#f9b4d0', '#7a2e55'],
  ['#d7ecff', '#a9d2ff', '#24466e'],
  ['#e3f9e5', '#b4ebc0', '#225c33'],
  ['#fff1c9', '#ffe08a', '#6e4f0b'],
  ['#ece0ff', '#cdb4ff', '#43287a'],
  ['#ffe2d1', '#ffc0a1', '#7a3818'],
  ['#d4f6f2', '#9fe6dc', '#14564e'],
  ['#fde2f3', '#e7c6ff', '#5b2a6e'],
];
