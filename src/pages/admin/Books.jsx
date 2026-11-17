import { useMemo, useState } from 'react';
import { useAdmin } from './Admin';
import { useStore } from '../../lib/state';
import { api } from '../../lib/api';
import { CATEGORIES, FORMATS, PALETTES } from '../../lib/config';
import { fmtMoney, slugify, ageLabel } from '../../lib/format';
import { BookCover, Modal, Spinner } from '../../components/ui';

const EMOJIS = ['📖', '🦄', '🐉', '🏰', '🧚', '🐻', '🦊', '🐰', '🦉', '🐭', '🐠', '🌈', '⭐', '🌙', '✨', '🪄', '🚀', '🦖', '🌸', '🎈', '🐘', '🦁', '🐢', '🍓'];
const blank = { title: '', author: '', illustrator: '', description: '', price: '', compare_at_price: '', age_min: 3, age_max: 6, category: CATEGORIES[0], tags: '', format: 'Hardcover', pages: 32, stock: 10, cover_url: null, emoji: '📖', palette: 0, featured: false, published: true };

function BookForm({ initial, onSaved, onCancel }) {
  const { toast } = useStore();
  const [f, setF] = useState(() => initial ? { ...initial, tags: (initial.tags || []).join(', '), compare_at_price: initial.compare_at_price || '' } : blank);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const up = (k, num) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : num ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value });

  const onFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 5e6) return toast('Please use an image under 5 MB', 'warn');
    setUploading(true);
    try { setF((x) => ({ ...x, cover_url: null })); const url = await api.books.uploadCover(file); setF((x) => ({ ...x, cover_url: url })); }
    catch (err) { toast(err.message, 'warn'); } finally { setUploading(false); }
  };

  const save = async (e) => {
    e.preventDefault();
    if (Number(f.age_min) > Number(f.age_max)) return toast('Minimum age must be ≤ maximum age', 'warn');
    setBusy(true);
    const payload = {
      title: f.title.trim(), slug: initial?.slug && initial.title === f.title ? initial.slug : slugify(f.title),
      author: f.author.trim(), illustrator: f.illustrator?.trim() || null, description: f.description,
      price: Number(f.price), compare_at_price: f.compare_at_price ? Number(f.compare_at_price) : null,
      age_min: Number(f.age_min), age_max: Number(f.age_max), category: f.category,
      tags: String(f.tags).split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      format: f.format, pages: Number(f.pages) || null, stock: Number(f.stock) || 0,
      cover_url: f.cover_url || null, emoji: f.emoji, palette: Number(f.palette), featured: !!f.featured, published: !!f.published,
    };
    try {
      const saved = initial ? await api.books.update(initial.id, payload) : await api.books.create(payload);
      toast(initial ? 'Book updated ✨' : 'New book added to the library 📚');
      onSaved(saved);
    } catch (err) { toast(err.message, 'warn'); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={save} className="book-form">
      <div className="cover-drop">
        <BookCover book={{ ...f, title: f.title || 'Your title', author: f.author || 'Author' }} />
        <label className="btn btn-ghost btn-sm" style={{ display: 'flex' }}>
          {uploading ? 'Uploading…' : '📷 Upload cover'}
          <input type="file" accept="image/*" hidden onChange={onFile} />
        </label>
        {f.cover_url && <button type="button" className="link-btn" onClick={() => setF({ ...f, cover_url: null })}>Use illustrated cover instead</button>}
        {!f.cover_url && (
          <>
            <small className="muted">No photo? Pick an icon & colour:</small>
            <div className="emoji-pick">{EMOJIS.map((e) => <button type="button" key={e} className={f.emoji === e ? 'on' : ''} onClick={() => setF({ ...f, emoji: e })}>{e}</button>)}</div>
            <div className="swatches">{PALETTES.map((p, i) => <button type="button" key={i} aria-label={`Palette ${i + 1}`} className={f.palette === i ? 'on' : ''} style={{ background: `linear-gradient(135deg, ${p[0]}, ${p[1]})` }} onClick={() => setF({ ...f, palette: i })} />)}</div>
          </>
        )}
      </div>
      <div className="form-grid">
        <label className="span-2">Title<input required value={f.title} onChange={up('title')} /></label>
        <label>Author<input required value={f.author} onChange={up('author')} /></label>
        <label>Illustrator<input value={f.illustrator || ''} onChange={up('illustrator')} /></label>
        <label className="span-2">Description<textarea rows={4} value={f.description} onChange={up('description')} /></label>
        <label>Price<input required type="number" min="0" step="0.01" value={f.price} onChange={up('price', true)} /></label>
        <label>Compare-at price <small className="muted">(shows “Sale”)</small><input type="number" min="0" step="0.01" value={f.compare_at_price} onChange={up('compare_at_price', true)} /></label>
        <label>Category<select value={f.category} onChange={up('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Format<select value={f.format} onChange={up('format')}>{FORMATS.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Age from<input type="number" min="0" max="18" value={f.age_min} onChange={up('age_min', true)} /></label>
        <label>Age to<input type="number" min="0" max="18" value={f.age_max} onChange={up('age_max', true)} /></label>
        <label>Pages<input type="number" min="0" value={f.pages || ''} onChange={up('pages', true)} /></label>
        <label>Stock{f.format === 'eBook' && <small className="muted"> (ignored for eBooks)</small>}<input type="number" min="0" value={f.stock} onChange={up('stock', true)} /></label>
        <label className="span-2">Tags <small className="muted">(comma separated)</small><input value={f.tags} onChange={up('tags')} placeholder="unicorn, bedtime, gift" /></label>
        <div className="switch-row"><span>Published (visible in shop)</span><label className="switch"><input type="checkbox" checked={f.published} onChange={up('published')} /><span /></label></div>
        <div className="switch-row"><span>Featured on homepage</span><label className="switch"><input type="checkbox" checked={f.featured} onChange={up('featured')} /><span /></label></div>
        <div className="span-2 row-gap" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn" disabled={busy || uploading}>{busy ? 'Saving…' : initial ? 'Save changes' : 'Add book'}</button>
        </div>
      </div>
    </form>
  );
}

export default function Books() {
  const { books, orders, loading, setData } = useAdmin();
  const { refreshBooks, toast } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | book
  const [sort, setSort] = useState({ k: 'created_at', dir: -1 });

  const sold = useMemo(() => {
    const m = {};
    orders.filter((o) => o.status !== 'cancelled').forEach((o) => o.items.forEach((i) => { m[i.book_id] = (m[i.book_id] || 0) + i.qty; }));
    return m;
  }, [orders]);

  const list = useMemo(() => {
    const n = q.toLowerCase();
    return books
      .filter((b) => (!n || `${b.title} ${b.author}`.toLowerCase().includes(n)) && (!cat || b.category === cat)
        && (!status || (status === 'draft' ? !b.published : status === 'low' ? b.format !== 'eBook' && b.stock <= 5 : status === 'featured' ? b.featured : b.published)))
      .sort((a, b) => {
        const va = sort.k === 'sold' ? sold[a.id] || 0 : a[sort.k]; const vb = sort.k === 'sold' ? sold[b.id] || 0 : b[sort.k];
        return (va > vb ? 1 : va < vb ? -1 : 0) * sort.dir;
      });
  }, [books, q, cat, status, sort, sold]);

  const sync = async () => { const all = await api.books.list({ includeUnpublished: true }); setData((d) => ({ ...d, books: all })); refreshBooks(); };
  const quick = async (b, patch) => { await api.books.update(b.id, patch); sync(); };
  const del = async (b) => { if (!confirm(`Delete “${b.title}”? This can’t be undone.`)) return; await api.books.remove(b.id); toast('Book removed'); sync(); };
  const th = (k, l) => <th data-sort onClick={() => setSort({ k, dir: sort.k === k ? -sort.dir : -1 })}>{l}{sort.k === k ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}</th>;

  if (loading) return <Spinner />;
  return (
    <>
      <div className="admin-top"><h1>📚 Books <small className="muted">({books.length})</small></h1><button className="btn" onClick={() => setEditing('new')}>+ Add a book</button></div>
      <div className="card">
        <div className="toolbar">
          <input placeholder="Search title or author…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option><option value="published">Published</option><option value="draft">Drafts</option><option value="featured">Featured</option><option value="low">Low stock</option></select>
        </div>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th /> {th('title', 'Title')}{th('category', 'Category')}<th>Age</th>{th('price', 'Price')}{th('stock', 'Stock')}{th('sold', 'Sold')}<th>Live</th><th>Featured</th><th /></tr></thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.id}>
                  <td className="thumb"><BookCover book={b} /></td>
                  <td><b>{b.title}</b><br /><small className="muted">{b.author} · {b.format}</small></td>
                  <td>{b.category}</td>
                  <td>{ageLabel(b)}</td>
                  <td>{fmtMoney(b.price)}</td>
                  <td>{b.format === 'eBook' ? '∞' : <span className={b.stock === 0 ? 'down' : b.stock <= 5 ? 'delta' : ''}>{b.stock}</span>}</td>
                  <td>{sold[b.id] || 0}</td>
                  <td><label className="switch"><input type="checkbox" checked={b.published} onChange={(e) => quick(b, { published: e.target.checked })} /><span /></label></td>
                  <td><label className="switch"><input type="checkbox" checked={b.featured} onChange={(e) => quick(b, { featured: e.target.checked })} /><span /></label></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="icon-btn" onClick={() => setEditing(b)} aria-label="Edit">✏️</button>{' '}
                    <button className="icon-btn" onClick={() => del(b)} aria-label="Delete">🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.length && <p className="muted center">No books match.</p>}
        </div>
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add a new book' : 'Edit book'} wide>
        {editing && <BookForm initial={editing === 'new' ? null : editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); sync(); }} />}
      </Modal>
    </>
  );
}
