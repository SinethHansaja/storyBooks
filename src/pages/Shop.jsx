import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../lib/state';
import { AGE_GROUPS, CATEGORIES, FORMATS } from '../lib/config';
import { BookCard, Empty, Spinner } from '../components/ui';
import { track } from '../lib/analytics';

const SORTS = { featured: 'Featured', new: 'Newest', priceAsc: 'Price: low → high', priceDesc: 'Price: high → low', rating: 'Top rated' };

export default function Shop() {
  const { books, booksLoading } = useStore();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const q = params.get('q') || '';
  const cat = params.get('cat') || '';
  const age = params.get('age') || '';
  const fmt = params.get('format') || '';
  const sort = params.get('sort') || 'featured';
  const maxPrice = Number(params.get('max') || 0);
  const inStock = params.get('stock') === '1';

  const set = (k, v) => { const p = new URLSearchParams(params); v ? p.set(k, v) : p.delete(k); setParams(p, { replace: true }); };

  const lastQ = useRef('');
  useEffect(() => {
    if (!q || q === lastQ.current) return;
    const t = setTimeout(() => { lastQ.current = q; track('search', { meta: { q } }); }, 700);
    return () => clearTimeout(t);
  }, [q]);

  const priceCeil = useMemo(() => Math.ceil(Math.max(1000, ...books.map((b) => b.price)) / 500) * 500, [books]);

  const list = useMemo(() => {
    const needle = q.toLowerCase();
    let r = books.filter((b) => {
      if (needle && !`${b.title} ${b.author} ${b.category} ${(b.tags || []).join(' ')}`.toLowerCase().includes(needle)) return false;
      if (cat && b.category !== cat) return false;
      if (fmt && b.format !== fmt) return false;
      if (age) { const [mn, mx] = age.split('-').map(Number); if (b.age_max < mn || b.age_min > mx) return false; }
      if (maxPrice && b.price > maxPrice) return false;
      if (inStock && b.format !== 'eBook' && b.stock <= 0) return false;
      return true;
    });
    const s = {
      featured: (a, b) => (b.featured - a.featured) || (b.rating_count - a.rating_count),
      new: (a, b) => new Date(b.created_at) - new Date(a.created_at),
      priceAsc: (a, b) => a.price - b.price,
      priceDesc: (a, b) => b.price - a.price,
      rating: (a, b) => b.rating_avg - a.rating_avg,
    }[sort];
    return [...r].sort(s);
  }, [books, q, cat, age, fmt, sort, maxPrice, inStock]);

  const active = [q && ['q', `“${q}”`], cat && ['cat', cat], age && ['age', `${age} yrs`], fmt && ['format', fmt], maxPrice && ['max', `≤ ${maxPrice}`], inStock && ['stock', 'In stock']].filter(Boolean);

  return (
    <div className="container section shop">
      <div className="shop-head">
        <div>
          <h1>{cat || (q ? 'Search results' : 'The Enchanted Library')}</h1>
          <p className="muted">{list.length} {list.length === 1 ? 'story' : 'stories'} waiting to be read</p>
        </div>
        <div className="shop-tools">
          <button className="btn btn-ghost filters-toggle" onClick={() => setFiltersOpen(!filtersOpen)}>🎛️ Filters</button>
          <select value={sort} onChange={(e) => set('sort', e.target.value === 'featured' ? '' : e.target.value)} aria-label="Sort">
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="shop-body">
        <aside className={`filters ${filtersOpen ? 'open' : ''}`}>
          <div className="filter-block">
            <h4>Search</h4>
            <input value={q} onChange={(e) => set('q', e.target.value)} placeholder="Title, author, theme…" />
          </div>
          <div className="filter-block">
            <h4>Age</h4>
            <div className="pill-row">
              {AGE_GROUPS.map((g) => {
                const v = `${g.min}-${g.max}`;
                return <button key={v} className={`pill ${age === v ? 'on' : ''}`} onClick={() => set('age', age === v ? '' : v)}>{g.label}</button>;
              })}
            </div>
          </div>
          <div className="filter-block">
            <h4>Category</h4>
            <div className="radio-list">
              <label><input type="radio" checked={!cat} onChange={() => set('cat', '')} /> All</label>
              {CATEGORIES.map((c) => <label key={c}><input type="radio" checked={cat === c} onChange={() => set('cat', c)} /> {c}</label>)}
            </div>
          </div>
          <div className="filter-block">
            <h4>Format</h4>
            <div className="pill-row">
              {FORMATS.map((f) => <button key={f} className={`pill ${fmt === f ? 'on' : ''}`} onClick={() => set('format', fmt === f ? '' : f)}>{f}</button>)}
            </div>
          </div>
          <div className="filter-block">
            <h4>Max price {maxPrice ? `— ${maxPrice}` : ''}</h4>
            <input type="range" min={500} max={priceCeil} step={250} value={maxPrice || priceCeil} onChange={(e) => set('max', Number(e.target.value) >= priceCeil ? '' : e.target.value)} />
          </div>
          <label className="check"><input type="checkbox" checked={inStock} onChange={(e) => set('stock', e.target.checked ? '1' : '')} /> In stock only</label>
        </aside>

        <div className="shop-results">
          {active.length > 0 && (
            <div className="active-filters">
              {active.map(([k, l]) => <button key={k} className="chip chip-x" onClick={() => set(k, '')}>{l} ✕</button>)}
              <button className="link-btn" onClick={() => setParams({})}>Clear all</button>
            </div>
          )}
          {booksLoading ? <Spinner /> : list.length === 0 ? (
            <Empty icon="🔮" title="No stories found">
              <p>Our crystal ball came up empty. Try fewer filters?</p>
              <button className="btn" onClick={() => setParams({})}>Reset filters</button>
            </Empty>
          ) : (
            <div className="grid">{list.map((b) => <BookCard key={b.id} book={b} />)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
