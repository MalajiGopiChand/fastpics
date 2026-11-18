import {missingConfiguration,publicSupabaseConfig} from '../../../lib/configuration.mjs';
import {adminClient,json} from '../../../lib/server';
export async function GET() {
  const missing=missingConfiguration(process.env);
  if(missing.length)return json({ready:false,code:'missing_configuration',missing},503);
  try {
    const db=adminClient();
    const checks=await Promise.all([
      db.from('events').select('id,owner_id,token,status').limit(0),
      db.from('photos').select('id,owner_id,event_id,descriptors,imagekit_file_id').limit(0),
      db.from('photographers').select('id').limit(0),
      db.rpc('fastpics_access_version')
    ]);
    if(checks.some(result=>result.error))return json({ready:false,code:'database_unavailable'},503);
    return json({ready:true,supabase:publicSupabaseConfig(process.env)});
  } catch { return json({ready:false,code:'database_unavailable'},503); }
}
