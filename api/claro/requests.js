const { randomBytes, createHash } = require('crypto');
const { CLASSES, STATUSES, actor, body, db, json } = require('../_lib/claro');

async function sendAlerts(row, classTeachers, kind, preference='email_requests') {
  if (!process.env.RESEND_API_KEY || !process.env.CLARO_FROM_EMAIL) return false;
  const recipients = new Set(classTeachers.filter(x => x[preference] !== false).map(x => x.email).filter(Boolean));
  if (process.env.CLARO_ADMIN_EMAIL) recipients.add(process.env.CLARO_ADMIN_EMAIL);
  if (row.receipt_email && row.source === 'student') recipients.add(row.receipt_email);
  let delivered=false;for (const to of recipients) {
    try { const receipt = kind === 'receipt' && row.receiptToken ? `<p><a href="${process.env.CLARO_PUBLIC_URL || 'https://clarospanish.vercel.app'}/?receipt=${encodeURIComponent(row.receiptToken)}">View request status</a></p>` : '';
      const copy=kind==='request'?'A Claro module request needs review.':kind==='receipt'?'Your Claro module request was received.':kind==='declined'?'The class teacher declined this request. You can send a new request if you would like to try again.':`Request status: ${row.status}.`;
      const subject=kind==='request'?`Claro module request · ${row.class_id}`:kind==='receipt'?`Claro request received · ${row.title}`:kind==='declined'?`Claro request decision · ${row.title}`:`Claro request update · ${row.title}`;
      const response=await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.CLARO_FROM_EMAIL, to: [to], subject, html: `<p>${copy}</p><p><strong>${escapeHtml(row.title)}</strong></p><p>${escapeHtml(row.description)}</p><p>Class: ${escapeHtml(row.class_id)}</p>${receipt}` }) });if(response.ok)delivered=true;
    } catch (_) { /* In-app notification remains authoritative if in-app delivery is available. */ }
  }return delivered;
}
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[ch]); }

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET' && req.query?.receipt) { const hash=createHash('sha256').update(String(req.query.receipt)).digest('hex'); const rows=await db(`claro_module_requests?receipt_token_hash=eq.${encodeURIComponent(hash)}&select=id,class_id,title,status,source,teacher_declined_at,created_at,updated_at`); return rows[0] ? json(res,200,{request:rows[0]}) : json(res,404,{error:'Request receipt not found.'}); }
    const user = await actor(req);
    if (req.method === 'POST') {
      const data = body(req);
      if (!CLASSES.includes(data.classId) || String(data.title || '').trim().length < 3 || String(data.description || '').trim().length < 8 || (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email).trim()))) return json(res, 400, { error: 'Choose a class and enter a clear module title and description.' });
      const source = user ? user.role : 'student';
      const receiptToken = source === 'student' && data.email ? randomBytes(32).toString('hex') : null;
      if (user?.role === 'teacher' && !user.classes.includes(data.classId)) return json(res, 403, { error: 'You are not assigned to that class.' });
      const rows = await db('claro_module_requests', { method: 'POST', body: JSON.stringify({ class_id: data.classId, title: String(data.title).trim().slice(0,160), description: String(data.description).trim().slice(0,4000), source, requester_id: user?.id || null, request_type: data.requestType === 'curriculum' ? 'curriculum' : 'module', student_name: !user && data.name ? String(data.name).trim().slice(0,100) : null, receipt_email: !user && data.email ? String(data.email).trim().slice(0,254) : null, receipt_token_hash: receiptToken ? createHash('sha256').update(receiptToken).digest('hex') : null, status: 'requested' }) });
      const row = rows[0];
      let receiptSent=false;
      await db('claro_request_events', { method: 'POST', body: JSON.stringify({ request_id: row.id, actor_id: user?.id || null, event_type: source === 'student' ? 'student_submitted' : 'request_submitted', status: 'requested' }) });
      if (source === 'student' || source === 'teacher') {
        const assigned = source === 'student' ? await db(`claro_teacher_classes?class_id=eq.${encodeURIComponent(data.classId)}&select=user_id`) : [];
        const teachersIds = assigned.map(x => x.user_id);
        const adminProfiles = await db('claro_profiles?role=eq.admin&select=user_id,display_name,email,email_requests');
        const adminIds = adminProfiles.map(x => x.user_id);
        const targetIds = [...new Set([...teachersIds, ...adminIds])];
        if (targetIds.length) await db('claro_notifications', { method: 'POST', body: JSON.stringify(targetIds.map(user_id => ({ user_id, class_id: data.classId, kind: 'request', title: source === 'student' ? 'Student module request' : 'Teacher module request', body: `${row.title}${row.student_name ? ` · ${row.student_name}` : ''}`, href: `${source === 'student' ? '/teacher' : '/admin'}?request=${row.id}` }))) });
        const teachers = teachersIds.length ? await db(`claro_profiles?user_id=in.(${teachersIds.join(',')})&select=user_id,display_name,email,email_requests`) : [];
        await sendAlerts(row, [...teachers, ...adminProfiles], 'request');
        if(row.receipt_email){receiptSent=await sendAlerts({...row,receiptToken},[{email:row.receipt_email,email_requests:true}],'receipt');}
      }
      return json(res, 201, { request: { id: row.id, classId: row.class_id, title: row.title, status: row.status, source: row.source, createdAt: row.created_at }, tracking: receiptSent, emailPending: !!row.receipt_email && !receiptSent });
    }
    if (req.method === 'GET') {
      if (!user) return json(res, 401, { error: 'Sign in to view requests.' });
      const scope = user.role === 'admin' ? '' : `&class_id=in.(${user.classes.join(',') || 'none'})`;
      const rows = await db(`claro_module_requests?select=*&order=created_at.desc${scope}`);
      const visible = user.role === 'teacher' ? rows.filter(r => user.classes.includes(r.class_id)) : rows;
      return json(res, 200, { requests: visible });
    }
    if (req.method === 'PATCH') {
      if (!user) return json(res, 401, { error: 'Sign in to update a request.' });
      const data = body(req);
      const matches = await db(`claro_module_requests?id=eq.${encodeURIComponent(data.id)}&select=*`);
      const row = matches[0];
      if (!row) return json(res, 404, { error: 'Request not found.' });
      if (user.role === 'teacher') {
        if (!user.classes.includes(row.class_id) || row.source !== 'student' || (row.teacher_approved_at||row.teacher_declined_at)) return json(res, 403, { error: 'This request is not awaiting your approval.' });
        if (data.action !== 'approve' && data.action !== 'decline') return json(res, 400, { error: 'Choose approve or decline.' });
        if (data.action === 'decline') {
          const updated = await db(`claro_module_requests?id=eq.${encodeURIComponent(row.id)}`, { method: 'PATCH', body: JSON.stringify({ status: 'requested', teacher_declined_at:new Date().toISOString(), updated_at: new Date().toISOString() }) });
          await db('claro_request_events', { method: 'POST', body: JSON.stringify({ request_id: row.id, actor_id: user.id, event_type: 'teacher_declined', status: 'requested', note: String(data.note || '').slice(0,1000) }) });
          if(row.receipt_email)await sendAlerts(updated[0], [{email:row.receipt_email,email_requests:true}], 'declined');
          const admins=await db('claro_profiles?role=eq.admin&select=user_id');if(admins.length)await db('claro_notifications',{method:'POST',body:JSON.stringify(admins.map(a=>({user_id:a.user_id,class_id:row.class_id,kind:'request',title:'Teacher declined a student request',body:row.title,href:`/admin?request=${row.id}`})))});
          return json(res, 200, { request: updated[0], declined: true });
        }
        const updated = await db(`claro_module_requests?id=eq.${encodeURIComponent(row.id)}`, { method: 'PATCH', body: JSON.stringify({ teacher_approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }) });
        await db('claro_request_events', { method: 'POST', body: JSON.stringify({ request_id: row.id, actor_id: user.id, event_type: 'teacher_approved', status: 'requested' }) });
        const admins=await db('claro_profiles?role=eq.admin&select=user_id'); if(admins.length) await db('claro_notifications',{method:'POST',body:JSON.stringify(admins.map(a=>({user_id:a.user_id,class_id:row.class_id,kind:'request',title:'Teacher approved a student request',body:row.title,href:`/admin?request=${row.id}`})))});
        return json(res, 200, { request: updated[0] });
      }
      if (user.role !== 'admin') return json(res, 403, { error: 'Admin access required.' });
      if (row.source === 'student' && (!row.teacher_approved_at || row.teacher_declined_at)) return json(res, 409, { error: 'The assigned teacher must approve this student request first.' });
      if (!STATUSES.includes(data.status)) return json(res, 400, { error: 'Invalid workflow stage.' });
      if(data.status!==row.status && STATUSES.indexOf(data.status)!==STATUSES.indexOf(row.status)+1)return json(res,409,{error:'Move requests one stage at a time.'});
      const updated = await db(`claro_module_requests?id=eq.${encodeURIComponent(row.id)}`, { method: 'PATCH', body: JSON.stringify({ status: data.status, updated_at: new Date().toISOString() }) });
      await db('claro_request_events', { method: 'POST', body: JSON.stringify({ request_id: row.id, actor_id: user.id, event_type: 'status_changed', status: data.status, note: String(data.note || '').slice(0,1000) }) });
      if(row.source==='student'&&row.receipt_email){await sendAlerts(row,[{email:row.receipt_email,email_requests:true}],'status');}
      const assigned=await db(`claro_teacher_classes?class_id=eq.${encodeURIComponent(row.class_id)}&select=user_id`);const teacherIds=assigned.map(x=>x.user_id);if(teacherIds.length){const teachers=await db(`claro_profiles?user_id=in.(${teacherIds.join(',')})&email_status_changes=eq.true&select=email,email_requests`);await sendAlerts(row,teachers,'status','email_status_changes');}
      return json(res, 200, { request: updated[0] });
    }
    return json(res, 405, { error: 'Method not allowed.' });
  } catch (error) { return json(res, error.message === 'Supabase is not configured.' ? 503 : 500, { error: error.message || 'Could not process request.' }); }
};
