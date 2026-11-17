import {requirePhotographer,ownedEvent,tokenValid,json,apiError} from '../../../../lib/server';
import {imagekitClient,imagekitPhotoUrls,removeImagekitFile} from '../../../../lib/imagekit';
import {validDescriptor} from '../../../../lib/matching.mjs';
export const maxDuration=60;
export async function GET(request) {
  try {
    const {db,user}=await requirePhotographer(request);
    const eventId=new URL(request.url).searchParams.get('eventId');
    await ownedEvent(db,user,eventId);
    const rows=[];
    for(let offset=0;offset<2000;offset+=500){
      const batch=await db.from('photos').select('id,event_id,name,path,size,face_count,created_at').eq('event_id',eventId).eq('owner_id',user.id).order('created_at',{ascending:false}).order('id').range(offset,offset+499);
      if(batch.error)throw batch.error;rows.push(...batch.data);if(batch.data.length<500)break;
    }
    return json({photos:rows.map(p=>imagekitPhotoUrls(p,3600))});
  }catch(error){return apiError(error);}
}
export async function POST(request) {
  try {
    const {db,user}=await requirePhotographer(request);
    const text=await request.text();if(text.length>250000)return json({error:'Too much face data.'},413);
    const body=JSON.parse(text);
    if(!tokenValid(body.id)||typeof body.fileId!=='string'||body.fileId.length>100||typeof body.name!=='string'||body.name.length>255||!Array.isArray(body.descriptors)||body.descriptors.length>50||!body.descriptors.every(validDescriptor))return json({error:'Invalid photo metadata.'},400);
    await ownedEvent(db,user,body.event_id);
    const asset=await imagekitClient().files.get(body.fileId);
    const expected=`/${user.id}/${body.event_id}/${body.id}.`;
    if(!asset.filePath?.startsWith(expected)||!['jpg','png','webp'].includes(asset.filePath.slice(expected.length))||asset.isPrivateFile!==true||asset.fileType!=='image'||!asset.size||asset.size>20*1024*1024)return json({error:'The uploaded file is not a valid private photo for this event.'},400);
    const row={id:body.id,event_id:body.event_id,owner_id:user.id,name:body.name,path:asset.filePath.slice(1),imagekit_file_id:body.fileId,size:asset.size,face_count:body.descriptors.length,descriptors:body.descriptors};
    const result=await db.from('photos').insert(row);
    if(result.error){
      // Avoid destroying a successfully finalized photo on a duplicate request.
      const existing=await db.from('photos').select('id,imagekit_file_id').eq('id',body.id).eq('owner_id',user.id).maybeSingle();
      if(existing.data?.imagekit_file_id===body.fileId)return json({ok:true});
      await removeImagekitFile(body.fileId);throw result.error;
    }
    return json({ok:true});
  } catch(error){return apiError(error);}
}
export async function DELETE(request) {
  try {
    const {db,user}=await requirePhotographer(request);
    const id=new URL(request.url).searchParams.get('id');
    if(!tokenValid(id))return json({error:'Invalid photo.'},400);
    const result=await db.from('photos').select('id,imagekit_file_id').eq('id',id).eq('owner_id',user.id).maybeSingle();
    if(result.error)throw result.error;if(!result.data)return json({error:'Photo not found.'},404);
    await removeImagekitFile(result.data.imagekit_file_id);
    const deleted=await db.from('photos').delete().eq('id',id).eq('owner_id',user.id);if(deleted.error)throw deleted.error;
    return json({ok:true});
  }catch(error){return apiError(error);}
}
