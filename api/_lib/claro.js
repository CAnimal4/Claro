const CLASSES = ['spanish1a', 'spanish1b', 'spanish2'];
const STATUSES = ['requested', 'in_review', 'approved', 'created', 'tested', 'published'];

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function config() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase is not configured.');
  return { url: process.env.SUPABASE_URL.replace(/\/$/, ''), anon: process.env.SUPABASE_ANON_KEY, service: process.env.SUPABASE_SERVICE_ROLE_KEY };
}

async function db(path, options = {}) {
  const c = config();
  const response = await fetch(`${c.url}/rest/v1/${path}`, { ...options, headers: { apikey: c.service, Authorization: `Bearer ${c.service}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(options.headers || {}) } });
  const text = await response.text();
  if (!response.ok) throw new Error(`Database request failed (${response.status}).`);
  return text ? JSON.parse(text) : [];
}

async function actor(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const c = config();
  const response = await fetch(`${c.url}/auth/v1/user`, { headers: { apikey: c.anon, Authorization: `Bearer ${token}` } });
  if (!response.ok) return null;
  const user = await response.json();
  let profiles = await db(`claro_profiles?user_id=eq.${encodeURIComponent(user.id)}&select=user_id,role,display_name`);
  if (!profiles.length && process.env.CLARO_BOOTSTRAP_ADMIN_EMAIL && String(user.email||'').toLowerCase() === process.env.CLARO_BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
    const existingAdmins=await db('claro_profiles?role=eq.admin&select=user_id&limit=1');
    if(!existingAdmins.length){profiles=await db('claro_profiles',{method:'POST',body:JSON.stringify({user_id:user.id,role:'admin',display_name:user.user_metadata?.display_name||user.email,email:user.email})});}
  }
  if (!profiles.length || !['teacher', 'admin'].includes(profiles[0].role)) return null;
  const classes = profiles[0].role === 'admin' ? CLASSES : (await db(`claro_teacher_classes?user_id=eq.${encodeURIComponent(user.id)}&select=class_id`)).map(x => x.class_id);
  return { id: user.id, email: user.email, role: profiles[0].role, displayName: profiles[0].display_name || user.email, classes };
}

function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (_) { return {}; }
}

function requireMethod(req, res, method) {
  if (req.method !== method) { json(res, 405, { error: 'Method not allowed.' }); return false; }
  return true;
}

module.exports = { CLASSES, STATUSES, actor, body, config, db, json, requireMethod };
