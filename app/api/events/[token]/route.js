import { adminClient, tokenValid, json, galleryAccess } from '../../../../lib/server';
export async function GET(request, {params}) {
  const {token} = await params;
  if (!tokenValid(token)) return json({error:'Invalid gallery link.'}, 404);
  try {
    const db = adminClient();
    const {data, error} = await db.from('events').select('name,date,location,category,owner_id').eq('token',token).eq('status','live').maybeSingle();
    if (error) return json({error:'Could not load this gallery. Please retry.'},503);
    if (!data) return json({error:'This gallery is not available. Please contact your photographer.'},404);
    if(!await galleryAccess(db,data.owner_id))return json({error:'This gallery is temporarily unavailable. Please contact your photographer.'},403);
    const {owner_id,...event}=data;return json(event);
  } catch { return json({error:'Cloud sharing is not configured yet. Ask your photographer to finish setup.'},503); }
}
