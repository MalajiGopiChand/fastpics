import {requireOwner,json,apiError,tokenValid} from '../../../../lib/server';
import {accountAccess} from '../../../../lib/access.mjs';
export async function GET(request){
  try{
    const {db}=await requireOwner(request);
    const page=Math.max(1,Math.min(10000,Number(new URL(request.url).searchParams.get('page'))||1));
    const result=await db.auth.admin.listUsers({page,perPage:25});if(result.error)throw result.error;
    const usage=await db.rpc('owner_client_usage',{p_ids:result.data.users.map(u=>u.id)});if(usage.error)return json({error:'Run owner-management.sql in Supabase to enable owner reporting.'},503);
    const clients=result.data.users.filter(u=>u.app_metadata?.fastpics_role!=='owner').map(u=>({id:u.id,email:u.email,studio:u.user_metadata?.studio_name||'',confirmed:!!u.email_confirmed_at,createdAt:u.created_at,lastLogin:u.last_sign_in_at,usage:usage.data?.[u.id],...accountAccess(u)}));
    return json({clients,page,hasMore:!!result.data.nextPage});
  }catch(e){return apiError(e);}
}
export async function PATCH(request){
  try{
    const {db,user}=await requireOwner(request);
    const raw=await request.text();if(raw.length>4096)return json({error:'Request too large.'},413);
    let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid request.'},400);}
    if(!tokenValid(body.id))return json({error:'Invalid client.'},400);
    const result=await db.auth.admin.getUserById(body.id);if(result.error||!result.data.user)return json({error:'Client not found.'},404);
    const target=result.data.user;
    if(target.app_metadata?.fastpics_role==='owner'||target.id===user.id)return json({error:'Owner accounts cannot be changed here.'},403);

    if(!['approve','suspend','resume','activate','cancel'].includes(body.action)||!tokenValid(body.requestId))return json({error:'Invalid account action or request ID.'},400);
    if(!target.email_confirmed_at){const confirmed=await db.auth.admin.updateUserById(target.id,{email_confirm:true});if(confirmed.error)throw confirmed.error;}
    const saved=await db.rpc('owner_change_access',{p_client:target.id,p_actor:user.id,p_action:body.action,p_request:body.requestId});
    if(saved.error){if(saved.error.code==='PGRST202')return json({error:'Run owner-management.sql in Supabase before managing subscriptions.'},503);throw saved.error;}
    return json({saved:true});
  }catch(e){return apiError(e);}
}
