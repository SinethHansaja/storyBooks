// Demo catalogue + synthetic history so the demo shop and dashboard feel alive.
// All titles are original placeholders — replace them with your real books from the admin panel.
import { slugify, uid } from './format';

const B = (title, author, category, price, age_min, age_max, emoji, palette, extra = {}) => ({
  id: uid(),
  slug: slugify(title),
  title,
  author,
  illustrator: extra.illustrator || author,
  description: extra.description ||
    `A gentle, beautifully illustrated tale perfect for curious little readers. "${title}" invites children into a world of wonder, kindness and imagination — ideal for reading together at bedtime or exploring on their own.`,
  price,
  compare_at_price: extra.compare_at_price || null,
  age_min, age_max,
  category,
  tags: extra.tags || [],
  format: extra.format || 'Hardcover',
  pages: extra.pages || 32,
  stock: extra.stock ?? 25,
  cover_url: null,
  emoji,
  palette,
  featured: !!extra.featured,
  published: true,
  rating_avg: extra.rating ?? 4.7,
  rating_count: extra.reviews ?? 18,
  created_at: new Date(Date.now() - (extra.daysAgo ?? 30) * 864e5).toISOString(),
});

export function seedBooks() {
  return [
    B('The Moonlit Unicorn', 'Lila Starling', 'Fairy Tales', 2450, 3, 7, '🦄', 4, { featured: true, compare_at_price: 2950, tags: ['unicorn', 'magic', 'bestseller'], rating: 4.9, reviews: 64, daysAgo: 60,
      description: 'When the moon forgets to rise, a shy little unicorn named Pearl must gather the courage to light up the night sky. A shimmering tale of bravery, friendship and believing in yourself.' }),
    B('Sleepy Bear’s Cloud Pillow', 'Oliver Dewdrop', 'Bedtime Stories', 1850, 0, 4, '🐻', 1, { featured: true, format: 'Board Book', pages: 20, tags: ['bedtime', 'soothing'], rating: 4.8, reviews: 41, daysAgo: 45 }),
    B('Princess Pip and the Paper Dragon', 'Maya Rosewood', 'Adventure', 2750, 5, 9, '🐉', 0, { featured: true, tags: ['dragon', 'princess', 'brave girls'], rating: 4.8, reviews: 37, daysAgo: 20 }),
    B('The Little Lighthouse Mouse', 'Theo Pemberton', 'Animals', 1950, 3, 6, '🐭', 6, { tags: ['ocean', 'kindness'], daysAgo: 90, stock: 4 }),
    B('Hello, Rainbow Garden!', 'Ava Bloom', 'Early Learning', 1450, 1, 4, '🌈', 2, { format: 'Board Book', pages: 16, tags: ['colours', 'nature'], rating: 4.6, reviews: 22, daysAgo: 12 }),
    B('Whispers of the Wishing Well', 'Lila Starling', 'Fantasy', 3250, 8, 12, '🪄', 7, { format: 'Hardcover', pages: 144, tags: ['chapter book', 'magic'], rating: 4.9, reviews: 29, daysAgo: 8, featured: true }),
    B('Two Friends and a Kite', 'Sam Okafor', 'Friendship', 1750, 4, 7, '🪁', 3, { format: 'Paperback', tags: ['friendship', 'outdoors'], daysAgo: 70 }),
    B('Twinkle Rhymes for Tiny Ears', 'Grace Nightingale', 'Rhymes & Poems', 1650, 0, 3, '⭐', 4, { format: 'Board Book', pages: 24, tags: ['rhymes', 'baby'], daysAgo: 100, rating: 4.5, reviews: 15 }),
    B('The Owl Who Couldn’t Hoot', 'Oliver Dewdrop', 'Animals', 2150, 3, 6, '🦉', 5, { tags: ['owls', 'self-belief'], daysAgo: 5 }),
    B('Castle in the Candyfloss Clouds', 'Maya Rosewood', 'Fairy Tales', 2950, 4, 8, '🏰', 0, { compare_at_price: 3400, tags: ['castle', 'sweet'], rating: 4.7, reviews: 33, daysAgo: 25 }),
    B('Captain Fin’s Bubble Voyage', 'Theo Pemberton', 'Adventure', 2350, 4, 8, '🐠', 1, { tags: ['ocean', 'pirates'], daysAgo: 3, stock: 0 }),
    B('Goodnight, Little Firefly (eBook)', 'Ava Bloom', 'Bedtime Stories', 990, 2, 6, '✨', 6, { format: 'eBook', stock: 9999, tags: ['digital', 'bedtime'], daysAgo: 15 }),
  ];
}

export const seedCoupons = () => [
  { id: uid(), code: 'FAIRY10', type: 'percent', value: 10, min_subtotal: 0, active: true, uses: 12, created_at: new Date().toISOString() },
  { id: uid(), code: 'WELCOME500', type: 'fixed', value: 500, min_subtotal: 3000, active: true, uses: 4, created_at: new Date().toISOString() },
];

export const seedSettings = () => ({
  store_name: 'Once Upon a Page',
  tagline: 'Magical storybooks for little dreamers',
  shipping_flat: 450,
  free_shipping_over: 7500,
  contact_email: 'hello@onceuponapage.lk',
  contact_phone: '+94 77 123 4567',
  announcement: '✨ Free delivery island-wide on orders over LKR 7,500 ✨',
  cod_enabled: true,
  bank_transfer_enabled: true,
  bank_details: 'Bank: Your Bank\nAccount name: Once Upon a Page\nAccount no: 0000 0000 0000\nBranch: Colombo',
  online_payment_enabled: false,
});

// ---------- synthetic analytics so the demo dashboard is populated ----------
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const NAMES = ['Nimali Perera', 'Kasun Silva', 'Amaya Fernando', 'Ravi Jayasuriya', 'Dilini Wijesinghe', 'Sahan Kumara', 'Ishara Gunawardena', 'Tharushi Mendis', 'Chamath Rajapaksha', 'Hiruni de Alwis'];
const CITIES = ['Colombo', 'Kandy', 'Galle', 'Negombo', 'Kurunegala', 'Jaffna', 'Matara'];
const REFS = ['direct', 'google', 'facebook', 'instagram', 'tiktok', 'whatsapp'];
const DEVICES = ['mobile', 'mobile', 'mobile', 'desktop', 'tablet'];
const SEARCHES = ['unicorn', 'bedtime', 'dragon', 'princess', 'animals', 'abc', 'dinosaur', 'rhymes', 'ocean'];

export function seedHistory(books) {
  const events = [];
  const orders = [];
  const customers = NAMES.map((name, i) => ({
    id: uid(),
    email: name.toLowerCase().replace(/[^a-z]+/g, '.') + '@example.com',
    name,
    role: 'customer',
    created_at: new Date(Date.now() - (60 - i * 5) * 864e5).toISOString(),
  }));
  const now = Date.now();
  let orderNo = 1000;
  for (let d = 29; d >= 0; d--) {
    const sessions = 18 + Math.floor(Math.random() * 22) + (29 - d);
    for (let s = 0; s < sessions; s++) {
      const sid = uid();
      const t0 = now - d * 864e5 - Math.random() * 864e5 * (d === 0 ? 0.4 : 1);
      const device = pick(DEVICES);
      const referrer = pick(REFS);
      const cust = Math.random() < 0.35 ? pick(customers) : null;
      const ev = (type, offset, extra = {}) =>
        events.push({ id: uid(), type, session_id: sid, user_id: cust?.id || null, device, referrer,
          created_at: new Date(t0 + offset * 1000).toISOString(), path: '/', book_id: null, meta: {}, ...extra });
      ev('page_view', 0, { path: '/' });
      if (Math.random() < 0.3) ev('search', 20, { path: '/shop', meta: { q: pick(SEARCHES) } });
      const viewed = Math.random() < 0.75 ? pick(books) : null;
      if (viewed) {
        ev('view_book', 40, { path: `/book/${viewed.slug}`, book_id: viewed.id, meta: { title: viewed.title } });
        if (Math.random() < 0.32) {
          ev('add_to_cart', 70, { path: `/book/${viewed.slug}`, book_id: viewed.id, meta: { title: viewed.title, qty: 1 } });
          if (Math.random() < 0.55) {
            ev('begin_checkout', 120, { path: '/checkout' });
            if (Math.random() < 0.6) {
              const c = cust || pick(customers);
              const extra = Math.random() < 0.35 ? pick(books) : null;
              const items = [{ book_id: viewed.id, title: viewed.title, price: viewed.price, qty: 1 }];
              if (extra && extra.id !== viewed.id) items.push({ book_id: extra.id, title: extra.title, price: extra.price, qty: 1 });
              const subtotal = items.reduce((a, i) => a + i.price * i.qty, 0);
              const shipping = subtotal >= 7500 ? 0 : 450;
              const ageDays = d;
              const status = ageDays > 6 ? 'delivered' : ageDays > 3 ? 'shipped' : ageDays > 1 ? 'processing' : 'pending';
              const order = {
                id: uid(), number: ++orderNo, user_id: c.id, email: c.email, name: c.name, phone: '+94 7' + Math.floor(10000000 + Math.random() * 89999999),
                address: { line1: `${Math.floor(Math.random() * 200)} Lotus Lane`, city: pick(CITIES), postal: '00' + Math.floor(100 + Math.random() * 899), country: 'Sri Lanka' },
                items, subtotal, discount: 0, shipping, total: subtotal + shipping, coupon_code: null,
                payment_method: pick(['cod', 'bank_transfer', 'cod']), payment_status: status === 'delivered' ? 'paid' : 'pending',
                status, notes: '', created_at: new Date(t0 + 180000).toISOString(),
              };
              orders.push(order);
              ev('purchase', 180, { path: '/checkout', user_id: c.id, meta: { order_id: order.id, number: order.number, total: order.total } });
            }
          }
        }
      }
    }
  }
  return { events, orders, customers };
}
