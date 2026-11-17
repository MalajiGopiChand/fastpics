import { createHash } from 'node:crypto';
import { adminClient, tokenValid, json } from '../../../../../lib/server';
import { validDescriptor, matchPhotos } from '../../../../../lib/matching.mjs';
import { imagekitPhotoUrls } from '../../../../../lib/imagekit';
export const maxDuration = 60;
export async function POST(request, {params}) {
  const {token} = await params;
  if (!tokenValid(token)) return json({error:'Invalid gallery link.'},404);
  if (Number(request.headers.get('content-length')) > 20000) return json({error:'Request too large.'},413);
  let body;
  try { const raw = await request.text(); if(raw.length > 20000) return json({error:'Request too large.'},413); body = JSON.parse(raw); } catch { return json({error:'Invalid request.'},400); }
  if (!validDescriptor(body.descriptor) || body.consent !== true) return json({error:'A valid selfie and consent are required.'},400);
  try {
    const db = adminClient();
    const {data:event,error} = await db.from('events').select('id').eq('token',token).eq('status','live').maybeSingle();
    if (error) throw error;
    if (!event) return json({error:'This gallery is not available.'},404);
    // Vercel overwrites this header. Other hosts must supply a trusted client IP.
    const ip = request.headers.get('x-vercel-forwarded-for') || 'local-development';
    const key = createHash('sha256').update(`${token}:${ip}:${process.env.SUPABASE_SERVICE_ROLE_KEY}`).digest('hex');
    const quota = await db.rpc('take_match_slot', {p_key: key});
    if (quota.error) throw quota.error;
    if (!quota.data) return json({error:'Too many searches. Please try again in a few minutes.'},429);
    let photos = [];
    for (let from=0; from<2000; from+=250) {
      const batch = await db.from('photos').select('id,name,path,descriptors').eq('event_id',event.id).order('id').range(from,from+249);
      if (batch.error) throw batch.error;
      photos.push(...batch.data); if(batch.data.length<250) break;
    }
    const matches = matchPhotos(photos,body.descriptor);
    if (!matches.length) return json({photos:[]});
    return json({photos: matches.map(p => imagekitPhotoUrls(p,600))});
  } catch { return json({error:'Photo search is unavailable right now. Please ask your photographer or try again shortly.'},503); }
}
