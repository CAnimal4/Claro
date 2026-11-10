const { actor, json } = require('../_lib/claro');
module.exports = async function handler(req,res){
  try { const user=await actor(req); if(!user)return json(res,401,{error:'Sign in required.'}); return json(res,200,{id:user.id,email:user.email,role:user.role,classes:user.classes}); }
  catch(error){return json(res,500,{error:error.message||'Could not load account.'});}
};
