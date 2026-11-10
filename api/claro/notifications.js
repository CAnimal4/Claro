const { actor, body, db, json } = require('../_lib/claro');

module.exports = async function handler(req, res) {
  try {
    const user = await actor(req);
    if (!user) return json(res, 401, { error: 'Sign in to manage notifications.' });
    if (req.method === 'GET') {
      const rows = await db(`claro_notifications?user_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc&limit=100`);
      return json(res, 200, { notifications: rows });
    }
    if (req.method === 'PATCH') {
      const data = body(req);
      const patch = {};
      if (data.read === true) patch.read_at = new Date().toISOString();
      if (data.dismiss === true) patch.dismissed_at = new Date().toISOString();
      if (data.dismiss === false) patch.dismissed_at = null;
      if (!Object.keys(patch).length) return json(res, 400, { error: 'Choose mark read or dismiss.' });
      await db(`claro_notifications?id=eq.${encodeURIComponent(data.id)}&user_id=eq.${encodeURIComponent(user.id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
      return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && user.role === 'admin') {
      const data = body(req);
      if (data.action !== 'announcement') return json(res, 400, { error: 'Unknown notification action.' });
      const teachers = await db('claro_profiles?role=eq.teacher&select=user_id,email,email_announcements');
      const rows = teachers.map(t => ({ user_id: t.user_id, kind: 'announcement', title: String(data.title || '').slice(0,160), body: String(data.body || '').slice(0,4000) })).filter(x => x.title && x.body);
      if (rows.length) await db('claro_notifications', { method: 'POST', body: JSON.stringify(rows) });
      if(process.env.RESEND_API_KEY&&process.env.CLARO_FROM_EMAIL){for(const t of teachers.filter(x=>x.email_announcements&&x.email)){try{await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.CLARO_FROM_EMAIL,to:[t.email],subject:String(data.title).slice(0,160),html:`<p>${String(data.body).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</p>`})});}catch(_){}}}
      return json(res, 201, { delivered: rows.length });
    }
    return json(res, 405, { error: 'Method not allowed.' });
  } catch (error) { return json(res, 500, { error: error.message || 'Could not manage notifications.' }); }
};
