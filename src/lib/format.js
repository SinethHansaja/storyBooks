import { config } from './config';

const money = new Intl.NumberFormat(config.locale, {
  style: 'currency',
  currency: config.currency,
  maximumFractionDigits: 2,
});

export const fmtMoney = (n) => money.format(Number(n) || 0);
export const fmtNum = (n) => new Intl.NumberFormat(config.locale).format(Number(n) || 0);
export const fmtDate = (d) =>
  new Date(d).toLocaleDateString(config.locale, { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDateTime = (d) =>
  new Date(d).toLocaleString(config.locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

export const ageLabel = (b) => (b.age_min === b.age_max ? `${b.age_min} yrs` : `${b.age_min}–${b.age_max} yrs`);
