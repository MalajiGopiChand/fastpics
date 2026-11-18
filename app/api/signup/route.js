import {createHash} from 'node:crypto';
import {adminClient,json,apiError} from '../../../lib/server';
import {signupValues} from '../../../lib/signup.mjs';
export async function POST(request){
 try{
  const raw=await request.text();if(raw.length>4096)return json({error:'Request too large.'},413);
  let values;try{values=signupValues(JSON.parse(raw));}catch(e){return json({error:e instanceof SyntaxError?'Invalid request.':e.message},400);}
  const db=adminClient();
  // Vercel supplies this trusted header; local development shares one rate-limit bucket.
  const ip=request.headers.get('x-vercel-forwarded-for')||'local-development';
  const key=createHash('sha256').update(`signup:${ip}:${process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY}`).digest('hex');
  const quota=await db.rpc('take_match_slot',{p_key:key});if(quota.error)throw quota.error;
  if(!quota.data)return json({error:'Too many signup attempts. Please try again in ten minutes.'},429);
  const result=await db.auth.admin.createUser(values);
  // Existing accounts are never changed by this public endpoint.
  if(result.error&&!['email_exists','email_address_exists'].includes(result.error.code))throw result.error;
  return json({message:'Sign in with your email and password. New accounts need owner approval before uploads; no email-confirmation link is required.'});
 }catch(e){return apiError(e);}
}
