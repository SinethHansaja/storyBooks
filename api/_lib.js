// Shared helpers for Vercel serverless functions (Node runtime).
// Uses the Supabase REST API directly with your SECRET key — server only.
export const env = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing environment variable ${k}`);
  return v;
};

// New Supabase secret keys (sb_secret_...) are not JWTs: they go ONLY in the
// `apikey` header. Legacy service_role JWTs are still accepted as a fallback.
const secretKey = () => process.env.SUPABASE_SECRET_KEY || env('SUPABASE_SERVICE_ROLE_KEY');

export async function sbFetch(path, init = {}) {
  const key = secretKey();
  const legacyJwt = key.startsWith('eyJ');
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      ...(legacyJwt ? { Authorization: `Bearer ${key}` } : {}),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

export const getOrder = async (id) => (await sbFetch(`orders?id=eq.${encodeURIComponent(id)}&select=*`))[0];
export const updateOrder = (id, patch) =>
  sbFetch(`orders?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });

export async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  const type = req.headers['content-type'] || '';
  if (type.includes('application/json')) return JSON.parse(raw || '{}');
  if (type.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(raw));
  return raw;
}
