import { createClient } from '@supabase/supabase-js';
export function adminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Cloud sharing is not configured yet. Ask your photographer to finish setup.');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession:false, autoRefreshToken:false}});
}
export const tokenValid = token => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token);
export const json = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control':'no-store'}});
export async function requirePhotographer(request) {
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'');
  if(!token)throw Object.assign(new Error('Please sign in.'),{status:401});
  const db=adminClient();
  const {data:{user},error}=await db.auth.getUser(token);
  if(error||!user)throw Object.assign(new Error('Your session expired. Please sign in again.'),{status:401});
  const membership=await db.from('photographers').select('id').eq('id',user.id).maybeSingle();
  if(membership.error||!membership.data)throw Object.assign(new Error('This account does not have photographer access.'),{status:403});
  return {db,user};
}
export async function ownedEvent(db,user,id) {
  if(!tokenValid(id))throw Object.assign(new Error('Invalid event.'),{status:400});
  const result=await db.from('events').select('id').eq('id',id).eq('owner_id',user.id).maybeSingle();
  if(result.error||!result.data)throw Object.assign(new Error('Event not found.'),{status:404});
  return result.data;
}
export function apiError(error) { return json({error:error.status && error.status<500?error.message:'The cloud operation failed. Check your connection and server configuration, then retry.'},error.status>=400&&error.status<500?error.status:503); }
