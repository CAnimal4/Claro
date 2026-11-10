const { CLASSES, actor, body, db, json } = require('../_lib/claro');
const escapeHtml = value => String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
module.exports = async function handler(req,res){
 try {
  if(req.method==='GET'){
   const classId=String(req.query?.classId||'');if(!CLASSES.includes(classId))return json(res,400,{error:'Choose a valid class.'});
   const user=await actor(req);if(user?.role==='teacher'&&!user.classes.includes(classId))return json(res,403,{error:'You are not assigned to that class.'});
   const statusFilter=user?.role==='admin'?'':'&status=eq.published';const rows=await db(`claro_modules?class_id=eq.${encodeURIComponent(classId)}${statusFilter}&order=created_at.desc`);
   return json(res,200,{modules:rows.map(r=>({...r,...(r.content||{}),id:r.id,slug:r.slug,class_id:r.class_id,title:r.title,summary:r.summary}))});
  }
  const user=await actor(req);if(!user||user.role!=='admin')return json(res,403,{error:'Admin access required.'});
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed.'});
  const d=body(req);
  if(d.action==='publish'){
   const current=(await db(`claro_modules?id=eq.${encodeURIComponent(d.id)}&select=*`))[0];if(!current)return json(res,404,{error:'Module not found.'});
   let linkedRequest=null;if(current.source_request_id){linkedRequest=(await db(`claro_module_requests?id=eq.${encodeURIComponent(current.source_request_id)}&select=*`))[0];if(!linkedRequest||linkedRequest.status!=='tested')return json(res,409,{error:'Finish testing this module and move its request to Tested before publishing.'});}
   const mod=(await db(`claro_modules?id=eq.${encodeURIComponent(current.id)}`,{method:'PATCH',body:JSON.stringify({status:'published',published_at:new Date().toISOString()})}))[0];
   if(linkedRequest){await db(`claro_module_requests?id=eq.${encodeURIComponent(linkedRequest.id)}`,{method:'PATCH',body:JSON.stringify({status:'published',updated_at:new Date().toISOString()})});await db('claro_request_events',{method:'POST',body:JSON.stringify({request_id:linkedRequest.id,actor_id:user.id,event_type:'module_published',status:'published'})});
    if(linkedRequest.source==='student'&&linkedRequest.receipt_email&&process.env.RESEND_API_KEY&&process.env.CLARO_FROM_EMAIL){try{await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.CLARO_FROM_EMAIL,to:[linkedRequest.receipt_email],subject:`Claro request update · ${linkedRequest.title}`,html:`<p>Your request for <strong>${escapeHtml(linkedRequest.title)}</strong> is now Published for ${escapeHtml(linkedRequest.class_id)}.</p><p>Use the status link in your original receipt to follow its progress.</p>`})})}catch(_){}}
   }
   const assignments=await db(`claro_teacher_classes?class_id=eq.${encodeURIComponent(mod.class_id)}&select=user_id`);const ids=assignments.map(x=>x.user_id);
   if(ids.length){await db('claro_notifications',{method:'POST',body:JSON.stringify(ids.map(user_id=>({user_id,class_id:mod.class_id,kind:'module',title:'New class module published',body:mod.title,href:'/teacher?class='+mod.class_id})))});
    if(process.env.RESEND_API_KEY&&process.env.CLARO_FROM_EMAIL){const teachers=await db(`claro_profiles?user_id=in.(${ids.join(',')})&email_new_modules=eq.true&select=email`);for(const t of teachers.filter(x=>x.email)){try{await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.CLARO_FROM_EMAIL,to:[t.email],subject:`Claro module published · ${mod.title}`,html:`<p>A module for your class is now available: <strong>${escapeHtml(mod.title)}</strong>.</p>`})})}catch(_){}}}
   }
   return json(res,200,{module:mod,requestPublished:!!linkedRequest});
  }
  const classId=String(d.classId||'');const title=String(d.title||'').trim().slice(0,160);const slug=String(d.slug||title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')).slice(0,80);const items=Array.isArray(d.items)?d.items:[];
  if(!CLASSES.includes(classId)||!title||!slug||!items.length)return json(res,400,{error:'Add a class, title, and at least one module item.'});
  for(const item of items){if(!item.id||!item.prompt||!item.answer)return json(res,400,{error:'Every item needs a stable id, prompt, and answer.'});if(item.choices&&!Array.isArray(item.choices))return json(res,400,{error:'Choices must be an array.'});if(item.acceptedAnswers&&!Array.isArray(item.acceptedAnswers))return json(res,400,{error:'Accepted answers must be an array.'});}
  let request=null;if(d.requestId){request=(await db(`claro_module_requests?id=eq.${encodeURIComponent(d.requestId)}&select=*`))[0];if(!request||request.class_id!==classId||request.status!=='created')return json(res,409,{error:'Choose a request for this class that has reached Created.'});}
  const rows=await db('claro_modules',{method:'POST',body:JSON.stringify({class_id:classId,title,slug,summary:String(d.summary||'').slice(0,500),content:{schemaVersion:1,items},source_request_id:request?.id||null,status:'draft',created_by:user.id})});
  return json(res,201,{module:rows[0]});
 }catch(e){return json(res,e.message==='Supabase is not configured.'?503:500,{error:e.message||'Could not load modules.'});}
};
