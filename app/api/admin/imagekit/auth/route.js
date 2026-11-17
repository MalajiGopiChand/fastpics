import {requirePhotographer,ownedEvent,tokenValid,json,apiError} from '../../../../../lib/server';
import {imagekitClient} from '../../../../../lib/imagekit';
export async function POST(request) {
  try {
    const {db,user}=await requirePhotographer(request);
    const body=await request.json();
    await ownedEvent(db,user,body.eventId);
    if(!tokenValid(body.photoId)||!['jpg','png','webp'].includes(body.extension))return json({error:'Invalid upload parameters.'},400);
    const auth=imagekitClient().helper.getAuthenticationParameters(crypto.randomUUID(),Math.floor(Date.now()/1000)+300);
    return json({...auth,publicKey:process.env.IMAGEKIT_PUBLIC_KEY,folder:`/${user.id}/${body.eventId}`,fileName:`${body.photoId}.${body.extension}`});
  } catch(error){return apiError(error);}
}
