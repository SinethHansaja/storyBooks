import { lazy, Suspense, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { StoreProvider } from './lib/state';
import Layout from './components/Layout';
import Home from './pages/Home';
import Shop from './pages/Shop';
import BookDetail from './pages/BookDetail';
import { Cart, Checkout, OrderSuccess } from './pages/Checkout';
import Account from './pages/Account';
import About, { NotFound } from './pages/About';
import { Spinner } from './components/ui';
import './styles/app.css';

const Admin = lazy(() => import('./pages/admin/Admin'));

// In-memory routing is only used for sandboxed static previews that can't rewrite URLs.
const Router = import.meta.env.VITE_MEMORY_ROUTER === 'true' ? MemoryRouter : BrowserRouter;

function RouteSpy() {
  const loc = useLocation();
  window.__oupPath = loc.pathname;
  return null;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router>
      <StoreProvider>
        <RouteSpy />
        <Routes>
          <Route path="/admin/*" element={<Suspense fallback={<Spinner />}><Admin /></Suspense>} />
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="shop" element={<Shop />} />
            <Route path="book/:slug" element={<BookDetail />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="order/:id" element={<OrderSuccess />} />
            <Route path="account" element={<Account />} />
            <Route path="about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </StoreProvider>
    </Router>
  </StrictMode>,
);
