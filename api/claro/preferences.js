const { actor, body, db, json } = require('../_lib/claro');

module.exports = async function handler(req, res) {
  try {
    const user = await actor(req);
    if (!user) return json(res, 401, { error: 'Sign in to manage preferences.' });
    if (req.method === 'GET') {
      const rows = await db(`claro_profiles?user_id=eq.${encodeURIComponent(user.id)}&select=email_requests,email_announcements,email_status_changes,email_new_modules,display_name,email`);
      return json(res, 200, { preferences: rows[0] || {} });
    }
    if (req.method !== 'PATCH') return json(res, 405, { error: 'Method not allowed.' });
    const data = body(req);
    const patch = {};
    for (const key of ['email_requests','email_announcements','email_status_changes','email_new_modules']) if (typeof data[key] === 'boolean') patch[key] = data[key];
    if (!Object.keys(patch).length) return json(res, 400, { error: 'No notification preferences supplied.' });
    const rows = await db(`claro_profiles?user_id=eq.${encodeURIComponent(user.id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
    return json(res, 200, { preferences: rows[0] || patch });
  } catch (error) { return json(res, 500, { error: error.message || 'Could not save preferences.' }); }
};
