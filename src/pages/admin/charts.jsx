// Tiny dependency-free SVG charts in the pastel palette.
import { useRef, useState } from 'react';

export const SERIES = ['#e2669f', '#7d61e0', '#3fa8e6', '#3dbb7a', '#e9a21f', '#ff8a65'];
const SOFT = ['#f7a8cb', '#b9a6ff', '#9fd8ff', '#a6e8c2', '#ffd36e', '#ffc0a1'];

function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
const short = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k' : Math.round(n));

/** Multi-series area/line chart. series: [{name, values, color}] labels: [] */
export function LineChart({ labels, series, height = 240, format = (v) => v }) {
  const W = 720, H = height, P = { l: 44, r: 12, t: 12, b: 28 };
  const [hover, setHover] = useState(null);
  const ref = useRef(null);
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const n = labels.length;
  const x = (i) => P.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - P.l - P.r));
  const y = (v) => P.t + (1 - v / max) * (H - P.t - P.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const every = Math.max(1, Math.ceil(n / 8));
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - P.l) / (W - P.l - P.r)) * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
  };
  return (
    <div style={{ position: 'relative' }}>
      <svg ref={ref} className="chart" viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img">
        <defs>
          {series.map((s, si) => (
            <linearGradient key={si} id={`g${si}${s.name.replace(/\W/g, '')}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={s.color || SERIES[si]} stopOpacity=".28" />
              <stop offset="1" stopColor={s.color || SERIES[si]} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t) => (
          <g key={t}><line className="grid-line" x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} /><text x={P.l - 8} y={y(t) + 4} textAnchor="end">{short(t)}</text></g>
        ))}
        {labels.map((l, i) => i % every === 0 && <text key={i} x={x(i)} y={H - 8} textAnchor="middle">{l}</text>)}
        {series.map((s, si) => {
          const c = s.color || SERIES[si];
          const pts = s.values.map((v, i) => `${x(i)},${y(v)}`);
          const line = 'M' + pts.join(' L');
          return (
            <g key={si}>
              {si === 0 && <path d={`${line} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#g${si}${s.name.replace(/\W/g, '')})`} />}
              <path d={line} fill="none" stroke={c} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '5 5' : undefined} />
            </g>
          );
        })}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="#d9c8e6" strokeDasharray="3 3" />
            {series.map((s, si) => <circle key={si} cx={x(hover)} cy={y(s.values[hover])} r="5" fill="#fff" stroke={s.color || SERIES[si]} strokeWidth="2.5" />)}
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(Math.max(...series.map((s) => s.values[hover]))) / H) * 100}%` }}>
          {labels[hover]} · {series.map((s) => `${s.name}: ${format(s.values[hover], s)}`).join(' · ')}
        </div>
      )}
    </div>
  );
}

export function BarList({ items, format = (v) => v, colorIndex = 0, empty = 'No data yet' }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="muted small">{empty}</p>;
  return (
    <div className="bars">
      {items.map((it, i) => (
        <div className="bar-row" key={it.label + i}>
          <span title={it.label}>{it.label}</span>
          <div className="bar-track"><i style={{ width: `${(it.value / max) * 100}%`, background: `linear-gradient(90deg, ${SOFT[(colorIndex + i) % SOFT.length]}, ${SERIES[(colorIndex + i) % SERIES.length]})` }} /></div>
          <span>{format(it.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function Donut({ items, size = 150 }) {
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  const R = 56, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox="0 0 150 150" role="img">
        <circle cx="75" cy="75" r={R} fill="none" stroke="#f6eff8" strokeWidth="20" />
        {items.map((it, i) => {
          const len = (it.value / total) * C;
          const el = <circle key={i} cx="75" cy="75" r={R} fill="none" stroke={SOFT[i % SOFT.length]} strokeWidth="20" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} transform="rotate(-90 75 75)" strokeLinecap="butt" />;
          acc += len; return el;
        })}
        <text x="75" y="72" textAnchor="middle" style={{ fontSize: 22, fontWeight: 700, fill: '#3d2b57', fontFamily: 'Fredoka' }}>{short(total)}</text>
        <text x="75" y="92" textAnchor="middle" style={{ fontSize: 11 }}>sessions</text>
      </svg>
      <div className="legend" style={{ flexDirection: 'column', gap: 6 }}>
        {items.map((it, i) => <span key={it.label}><i style={{ background: SOFT[i % SOFT.length] }} />{it.label} · {Math.round((it.value / total) * 100)}%</span>)}
      </div>
    </div>
  );
}

export function Funnel({ steps }) {
  const top = Math.max(1, steps[0]?.value || 1);
  return (
    <div className="funnel">
      {steps.map((s, i) => {
        const pct = (s.value / top) * 100;
        const conv = i === 0 ? null : steps[i - 1].value ? Math.round((s.value / steps[i - 1].value) * 100) : 0;
        return (
          <div className="funnel-step" key={s.label}>
            <span>{s.label}</span>
            <div><div className="funnel-bar" style={{ width: `${Math.max(pct, 4)}%`, background: `linear-gradient(90deg, ${SOFT[i % SOFT.length]}, ${SOFT[(i + 1) % SOFT.length]})` }}>{s.value}</div></div>
            <small className="muted">{conv == null ? '100%' : `${conv}% → `}</small>
          </div>
        );
      })}
    </div>
  );
}

/** 7×24 heatmap of activity. grid[day][hour] */
export function Heatmap({ grid }) {
  const max = Math.max(1, ...grid.flat());
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (
    <div className="heat">
      <span />{Array.from({ length: 24 }).map((_, h) => <span key={h} style={{ textAlign: 'center' }}>{h % 3 === 0 ? h : ''}</span>)}
      {grid.map((row, d) => (
        <FragmentRow key={d} label={days[d]} row={row} max={max} />
      ))}
    </div>
  );
}
function FragmentRow({ label, row, max }) {
  return (
    <>
      <span>{label}</span>
      {row.map((v, h) => <i key={h} title={`${label} ${h}:00 — ${v} events`} style={{ background: v ? `rgba(125, 97, 224, ${0.12 + (v / max) * 0.8})` : '#f6eff8' }} />)}
    </>
  );
}
