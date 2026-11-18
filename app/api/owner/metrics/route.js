import {requireOwner,json,apiError} from '../../../../lib/server';
export async function GET(request){
 try{const {db}=await requireOwner(request);const result=await db.rpc('owner_metrics');
 if(result.error){if(result.error.code==='PGRST202')return json({error:'Run owner-management.sql in Supabase to enable owner reporting.'},503);throw result.error;}
 return json(result.data);
 }catch(e){return apiError(e);}
}
