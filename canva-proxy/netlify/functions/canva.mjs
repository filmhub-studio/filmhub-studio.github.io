// Film Hub ↔ Canva Connect proxy (Netlify Function).
// Keeps your Canva client secret off the website and forwards API calls (Canva's API does not allow calls straight from a browser).
// Env vars to set in Netlify: CANVA_CLIENT_ID, CANVA_CLIENT_SECRET, ALLOWED_ORIGIN (e.g. https://yourname.github.io)
const API = 'https://api.canva.com/rest/v1';
const cors = (origin) => ({
  'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Canva-Path, X-Canva-Method, Asset-Upload-Metadata',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Vary': 'Origin' });
export default async (req) => {
  const allowed = (process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers.get('origin') || '';
  const ok = allowed.includes(origin) || origin.startsWith('http://localhost');
  const H = cors(ok ? origin : allowed[0] || '');
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: H });
  if (!ok) return new Response(JSON.stringify({ error: 'origin not allowed' }), { status: 403, headers: H });
  const url = new URL(req.url); const op = url.searchParams.get('op');
  const basic = 'Basic ' + Buffer.from(`${process.env.CANVA_CLIENT_ID}:${process.env.CANVA_CLIENT_SECRET}`).toString('base64');
  try {
    if (op === 'config') return Response.json({ client_id: process.env.CANVA_CLIENT_ID }, { headers: H });
    if (op === 'token' || op === 'refresh') { // body: {code, code_verifier, redirect_uri} or {refresh_token}
      const b = await req.json(); const form = new URLSearchParams(op === 'token'
        ? { grant_type: 'authorization_code', code: b.code, code_verifier: b.code_verifier, redirect_uri: b.redirect_uri }
        : { grant_type: 'refresh_token', refresh_token: b.refresh_token });
      const r = await fetch(API + '/oauth/token', { method: 'POST', headers: { Authorization: basic, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
      return new Response(await r.text(), { status: r.status, headers: { ...H, 'Content-Type': 'application/json' } });
    }
    if (op === 'api') { // forwards to Canva with the user's own access token
      const path = req.headers.get('x-canva-path') || ''; if (!/^\/[a-z0-9\-\/_]+(\?.*)?$/i.test(path)) throw new Error('bad path');
      const method = req.headers.get('x-canva-method') || req.method;
      const headers = { Authorization: req.headers.get('authorization') || '' };
      const ct = req.headers.get('content-type'); if (ct) headers['Content-Type'] = ct;
      const meta = req.headers.get('asset-upload-metadata'); if (meta) headers['Asset-Upload-Metadata'] = meta;
      const r = await fetch(API + path, { method, headers, body: method === 'GET' ? undefined : await req.arrayBuffer() });
      return new Response(await r.text(), { status: r.status, headers: { ...H, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: 'unknown op' }), { status: 400, headers: H });
  } catch (e) { return new Response(JSON.stringify({ error: String(e.message || e) }), { status: 500, headers: H }); }
};
export const config = { path: '/canva' };
