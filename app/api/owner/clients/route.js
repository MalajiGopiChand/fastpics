import {requireOwner,json,apiError,tokenValid} from '../../../../lib/server';
import {accountAccess,changeSubscription} from '../../../../lib/access.mjs';
export async function GET(request){
  try{
    const {db}=await requireOwner(request);
    const page=Math.max(1,Math.min(10000,Number(new URL(request.url).searchParams.get('page'))||1));
    const result=await db.auth.admin.listUsers({page,perPage:25});if(result.error)throw result.error;
    const clients=result.data.users.map(u=>({id:u.id,email:u.email,studio:u.user_metadata?.studio_name||'',confirmed:!!u.email_confirmed_at,createdAt:u.created_at,...accountAccess(u)}));
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
    if(!target.email_confirmed_at)return json({error:'The client must confirm their email first.'},409);
    let subscription;try{subscription=changeSubscription(target.app_metadata?.fastpics_subscription||{},body.action);}catch(e){return json({error:e.message},400);}
    subscription.updated_at=new Date().toISOString();subscription.updated_by=user.id;
    // Membership alone never grants access: current server metadata and RLS must also permit it.
    if(subscription.approved){const membership=await db.from('photographers').upsert({id:target.id});if(membership.error)throw membership.error;}
    const saved=await db.auth.admin.updateUserById(target.id,{app_metadata:{...target.app_metadata,fastpics_subscription:subscription}});if(saved.error)throw saved.error;
    return json({access:accountAccess(saved.data.user)});
  }catch(e){return apiError(e);}
}
