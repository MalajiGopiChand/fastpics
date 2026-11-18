import {requireOwner,json,apiError,tokenValid} from '../../../../../lib/server';
export async function GET(request,{params}){
 try{const {db}=await requireOwner(request);const {id}=await params;if(!tokenValid(id))return json({error:'Invalid client.'},400);
 const [events,photos]=await Promise.all([db.from('events').select('id,name,date,location,status',{count:'exact'}).eq('owner_id',id).order('created_at',{ascending:false}).limit(100),db.from('photos').select('id',{count:'exact',head:true}).eq('owner_id',id)]);
 if(events.error||photos.error)throw events.error||photos.error;
 return json({id,events:events.data,totalEvents:events.count,totalPhotos:photos.count});
 }catch(e){return apiError(e);}
}
export async function PATCH(request,{params}){
 try{const {db}=await requireOwner(request);const {id}=await params;const raw=await request.text();if(raw.length>1024)return json({error:'Request too large.'},413);let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid request.'},400);}
 if(!tokenValid(id)||!tokenValid(body.eventId)||!['live','draft'].includes(body.status))return json({error:'Invalid gallery update.'},400);
 const result=await db.from('events').update({status:body.status}).eq('id',body.eventId).eq('owner_id',id).select('id').maybeSingle();if(result.error)throw result.error;if(!result.data)return json({error:'Gallery not found.'},404);return json({saved:true});
 }catch(e){return apiError(e);}
}
