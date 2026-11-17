import { useEffect, useMemo, useRef, useState } from 'react';
import { useAdmin } from './Admin';
import { FeedItem, useNow } from './Dashboard';
import { EVENT_LABELS } from '../../lib/analytics';
import { fmtDateTime, timeAgo } from '../../lib/format';
import { Modal, Spinner } from '../../components/ui';
import { downloadCSV } from './Orders';

export default function Activity() {
  const { events, customers, loading } = useAdmin();
  const [type, setType] = useState('');
  const [tab, setTab] = useState('stream');
  const [session, setSession] = useState(null);
  const now = useNow(5000);
  const seen = useRef(new Set());
  const [fresh, setFresh] = useState(new Set());

  useEffect(() => {
    if (!seen.current.size) { events.forEach((e) => seen.current.add(e.id)); return; }
    const n = events.filter((e) => !seen.current.has(e.id)).map((e) => e.id);
    if (n.length) { n.forEach((id) => seen.current.add(id)); setFresh(new Set(n)); }
  }, [events]);

  const stream = useMemo(() => events.filter((e) => !type || e.type === type).slice(-200).reverse(), [events, type]);

  const sessions = useMemo(() => {
    const m = {};
    events.forEach((e) => { (m[e.session_id] ||= []).push(e); });
    return Object.entries(m).map(([id, evs]) => {
      const first = evs[0], last = evs[evs.length - 1];
      return {
        id, evs, first, last,
        duration: (new Date(last.created_at) - new Date(first.created_at)) / 1000,
        purchased: evs.some((e) => e.type === 'purchase'),
        carted: evs.some((e) => e.type === 'add_to_cart'),
        user: customers.find((c) => c.id === evs.find((e) => e.user_id)?.user_id),
        live: now - new Date(last.created_at).getTime() < 5 * 60e3,
      };
    }).sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at)).slice(0, 150);
  }, [events, customers, now]);

  const live = sessions.filter((s) => s.live);
  if (loading) return <Spinner />;

  return (
    <>
      <div className="admin-top">
        <div><h1>⚡ Live activity</h1><span className="live-dot">{live.length} active session{live.length === 1 ? '' : 's'} · updates in real time</span></div>
        <button className="btn btn-ghost" onClick={() => downloadCSV('events.csv', events.map((e) => ({ time: e.created_at, type: e.type, session: e.session_id, user: e.user_id || '', path: e.path, detail: e.meta?.title || e.meta?.q || '', device: e.device, source: e.referrer })))}>⬇️ Export events</button>
      </div>
      <div className="tabs tabs-lg">
        <button className={tab === 'stream' ? 'on' : ''} onClick={() => setTab('stream')}>Event stream</button>
        <button className={tab === 'sessions' ? 'on' : ''} onClick={() => setTab('sessions')}>Visitor journeys</button>
      </div>

      {tab === 'stream' ? (
        <div className="card">
          <div className="toolbar">
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All events</option>
              {Object.entries(EVENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
            <small className="muted">Showing latest {stream.length}</small>
          </div>
          <ul className="feed" style={{ maxHeight: 'none' }}>
            {stream.map((e) => <FeedItem key={e.id} e={e} customers={customers} isNew={fresh.has(e.id)} />)}
          </ul>
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="tbl">
            <thead><tr><th>Visitor</th><th>Started</th><th>Duration</th><th>Steps</th><th>Source</th><th>Device</th><th>Outcome</th></tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="clickable" onClick={() => setSession(s)}>
                  <td>{s.live && <span className="live-dot" />} <b>{s.user?.name || `Guest ${s.id.slice(0, 4)}`}</b></td>
                  <td>{timeAgo(s.first.created_at)}</td>
                  <td>{s.duration < 60 ? `${Math.round(s.duration)}s` : `${Math.round(s.duration / 60)}m`}</td>
                  <td>{s.evs.length}</td>
                  <td>{s.first.referrer}</td>
                  <td>{s.first.device}</td>
                  <td><span className={`status ${s.purchased ? 's-delivered' : s.carted ? 's-pending' : 's-processing'}`}>{s.purchased ? 'Purchased' : s.carted ? 'Abandoned cart' : 'Browsed'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!session} onClose={() => setSession(null)} title="Visitor journey">
        {session && (
          <ul className="timeline">
            {session.evs.map((e) => (
              <li key={e.id}>{EVENT_LABELS[e.type]?.icon} <b>{EVENT_LABELS[e.type]?.label || e.type}</b> {e.meta?.title || e.meta?.q || ''}<br /><small className="muted">{fmtDateTime(e.created_at)} · {e.path}</small></li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}
