import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { track, setAnalyticsUser } from './analytics';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const readLS = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

export function StoreProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [books, setBooks] = useState([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [cart, setCart] = useState(() => readLS('oup:cart', []));
  const [wishlist, setWishlist] = useState(() => readLS('oup:wish', []));
  const [cartOpen, setCartOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, kind = 'ok') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const refreshBooks = useCallback(async () => {
    try { setBooks(await api.books.list()); } finally { setBooksLoading(false); }
  }, []);

  const refreshSettings = useCallback(async () => setSettings(await api.settings.get()), []);

  useEffect(() => {
    api.auth.current().then((u) => { setUser(u); setAnalyticsUser(u?.id); }).finally(() => setAuthReady(true));
    const off = api.auth.onChange((u) => { setUser(u); setAnalyticsUser(u?.id); });
    refreshBooks();
    refreshSettings();
    return off;
  }, [refreshBooks, refreshSettings]);

  useEffect(() => localStorage.setItem('oup:cart', JSON.stringify(cart)), [cart]);
  useEffect(() => localStorage.setItem('oup:wish', JSON.stringify(wishlist)), [wishlist]);

  const byId = useMemo(() => Object.fromEntries(books.map((b) => [b.id, b])), [books]);

  const cartLines = useMemo(
    () => cart.map((l) => ({ ...l, book: byId[l.book_id] })).filter((l) => l.book),
    [cart, byId],
  );
  const cartCount = cartLines.reduce((a, l) => a + l.qty, 0);
  const subtotal = cartLines.reduce((a, l) => a + l.qty * Number(l.book.price), 0);

  const addToCart = (book, qty = 1) => {
    if (book.format !== 'eBook' && book.stock <= 0) return toast('Oh no — this book is sold out!', 'warn');
    setCart((c) => {
      const ex = c.find((l) => l.book_id === book.id);
      const max = book.format === 'eBook' ? 1 : book.stock;
      if (ex) return c.map((l) => (l.book_id === book.id ? { ...l, qty: Math.min(max, l.qty + qty) } : l));
      return [...c, { book_id: book.id, qty: Math.min(max, qty) }];
    });
    track('add_to_cart', { book_id: book.id, meta: { title: book.title, qty } });
    toast(`“${book.title}” flew into your basket ✨`);
  };
  const setQty = (bookId, qty) => {
    const b = byId[bookId];
    const max = b?.format === 'eBook' ? 1 : b?.stock ?? 99;
    if (qty <= 0) return removeFromCart(bookId);
    setCart((c) => c.map((l) => (l.book_id === bookId ? { ...l, qty: Math.min(max, qty) } : l)));
  };
  const removeFromCart = (bookId) => {
    setCart((c) => c.filter((l) => l.book_id !== bookId));
    track('remove_from_cart', { book_id: bookId, meta: { title: byId[bookId]?.title } });
  };
  const clearCart = () => setCart([]);

  const toggleWish = (book) => {
    setWishlist((w) => {
      if (w.includes(book.id)) return w.filter((x) => x !== book.id);
      track('add_to_wishlist', { book_id: book.id, meta: { title: book.title } });
      toast('Saved to your wishlist 💖');
      return [...w, book.id];
    });
  };

  const value = {
    user, setUser, authReady, isAdmin: user?.role === 'admin',
    books, booksLoading, refreshBooks, byId,
    settings, refreshSettings,
    cart: cartLines, cartCount, subtotal, addToCart, setQty, removeFromCart, clearCart, cartOpen, setCartOpen,
    wishlist, toggleWish,
    toast, toasts,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** shipping/discount calc used by cart + checkout (server re-validates in Supabase mode) */
export function priceSummary(subtotal, settings, coupon, needsShipping = true) {
  let discount = 0;
  if (coupon && subtotal >= Number(coupon.min_subtotal || 0)) {
    discount = coupon.type === 'percent' ? Math.round(subtotal * coupon.value) / 100 : Math.min(subtotal, Number(coupon.value));
  }
  const after = subtotal - discount;
  const freeOver = Number(settings?.free_shipping_over || 0);
  const shipping = subtotal === 0 || !needsShipping ? 0 : freeOver && after >= freeOver ? 0 : Number(settings?.shipping_flat || 0);
  return { subtotal, discount, shipping, total: Math.max(0, after + shipping) };
}
