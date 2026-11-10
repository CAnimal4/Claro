const { CLASSES, actor, body, db, json } = require('../_lib/claro');

module.exports = async function handler(req, res) {
  try {
    const user = await actor(req);
    if (!user || user.role !== 'admin') return json(res, 403, { error: 'Admin access required.' });
    const c = require('../_lib/claro').config();
    if (req.method === 'GET') {
      const profiles = await db('claro_profiles?select=user_id,display_name,email,role,email_requests,email_announcements,email_status_changes,email_new_modules&order=display_name.asc');
      const assignments = await db('claro_teacher_classes?select=user_id,class_id');
      return json(res, 200, { teachers: profiles.filter(p => p.role === 'teacher').map(p => ({ ...p, classes: assignments.filter(a => a.user_id === p.user_id).map(a => a.class_id) })), classes: CLASSES });
    }
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
    const data = body(req);
    if (data.action === 'invite') {
      const email = String(data.email || '').trim().toLowerCase();
      const displayName = String(data.displayName || '').trim().slice(0,100);
      const classes = [...new Set((data.classes || []).filter(x => CLASSES.includes(x)))];
      if (!email.includes('@') || !displayName || !classes.length) return json(res, 400, { error: 'Enter a name, valid email, and at least one class.' });
      const invited = await fetch(`${c.url}/auth/v1/invite`, { method: 'POST', headers: { apikey: c.service, Authorization: `Bearer ${c.service}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, data: { display_name: displayName } }) });
      const invitedText = await invited.text();
      if (!invited.ok) return json(res, invited.status, { error: 'Could not invite this teacher. Check for an existing account and Supabase email configuration.' });
      const authUser = JSON.parse(invitedText);
      await db('claro_profiles', { method: 'POST', body: JSON.stringify({ user_id: authUser.id, role: 'teacher', display_name: displayName, email }) });
      await db('claro_teacher_classes', { method: 'POST', body: JSON.stringify(classes.map(class_id => ({ user_id: authUser.id, class_id }))) });
      return json(res, 201, { teacher: { id: authUser.id, displayName, email, classes } });
    }
    if (data.action === 'assign') {
      const teacherId = String(data.teacherId || '');
      const classes = [...new Set((data.classes || []).filter(x => CLASSES.includes(x)))];
      const profiles = await db(`claro_profiles?user_id=eq.${encodeURIComponent(teacherId)}&select=role`);
      if (profiles[0]?.role !== 'teacher') return json(res, 404, { error: 'Teacher account not found.' });
      await db(`claro_teacher_classes?user_id=eq.${encodeURIComponent(teacherId)}`, { method: 'DELETE' });
      if (classes.length) await db('claro_teacher_classes', { method: 'POST', body: JSON.stringify(classes.map(class_id => ({ user_id: teacherId, class_id }))) });
      return json(res, 200, { ok: true, classes });
    }
    return json(res, 400, { error: 'Unknown admin action.' });
  } catch (error) { return json(res, 500, { error: error.message || 'Could not manage Claro accounts.' }); }
};
