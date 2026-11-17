import { openDB } from 'idb';
import { createClient } from '@supabase/supabase-js';
import { matchPhotos } from './matching.mjs';
export const cloudEnabled = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
export const supabase = cloudEnabled ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) : null;
const db = () => openDB('framefind-v1', 1, { upgrade(db) { db.createObjectStore('events', {keyPath: 'id'}); const photos = db.createObjectStore('photos', {keyPath: 'id'}); photos.createIndex('event_id', 'event_id'); } });
export async function summary() {
  let rows=[];
  if(cloudEnabled) {
    for(let offset=0;;offset+=500){const batch=checked(await supabase.from('photos').select('id,event_id,size,face_count').order('id').range(offset,offset+499));rows.push(...batch);if(batch.length<500)break;}
  } else rows=await (await db()).getAll('photos');
  return rows.reduce((stats,p) => { const s = stats[p.event_id] ||= {count:0,size:0,indexed:0}; s.count++; s.size+=p.size; s.indexed+=p.face_count>0?1:0; return stats; },{});
}
export async function seedDemo() {
  const local = await db();
  if (localStorage.getItem('framefind-welcomed')) return;
  if (!(await local.count('events'))) {
    const samples = [
      {name:'Aarya & Arjun',date:'2026-11-14',location:'Hyderabad',category:'Wedding'},
      {name:'The studio launch',date:'2026-11-12',location:'Jubilee Hills',category:'Corporate'},
      {name:'An evening to remember',date:'2026-11-10',location:'Bengaluru',category:'Celebration'}
    ];
    for(let i=0;i<samples.length;i++) await local.put('events',{...samples[i],id:crypto.randomUUID(),token:crypto.randomUUID(),status:'draft',cover:covers[i],sample:true,created_at:new Date(Date.now()-i*1000).toISOString()});
  }
  localStorage.setItem('framefind-welcomed','1');
}
export const covers = [
  'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1000&q=85',
  'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1000&q=85',
  'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=1000&q=85'
];
function checked(result) { if (result.error) throw new Error(result.error.message); return result.data; }
async function adminRequest(url,options={}) {
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)throw new Error('Please sign in again.');
  const res=await fetch(url,{...options,headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`,...options.headers}});
  const data=await res.json();if(!res.ok)throw new Error(data.error||'Cloud request failed.');return data;
}
export async function listEvents() {
  if (cloudEnabled) return checked(await supabase.from('events').select('*').order('created_at', {ascending: false}));
  return (await (await db()).getAll('events')).sort((a,b) => b.created_at.localeCompare(a.created_at));
}
export async function createEvent(values) {
  const event = {id: crypto.randomUUID(), token: crypto.randomUUID(), name: values.name, date: values.date, location: values.location, category: values.category, status: 'draft', cover: '', created_at: new Date().toISOString()};
  if (cloudEnabled) {
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) throw new Error('Please sign in to create an event.');
    return checked(await supabase.from('events').insert({...event, owner_id: user.id}).select().single());
  }
  await (await db()).put('events', event); return event;
}
export async function updateEvent(event, values) {
  if (cloudEnabled) return checked(await supabase.from('events').update(values).eq('id', event.id).select().single());
  const updated = {...event, ...values}; await (await db()).put('events', updated); return updated;
}
export async function getPhotos(eventId) {
  if (cloudEnabled) {
    return (await adminRequest(`/api/admin/photos?eventId=${eventId}`)).photos;
  }
  return (await (await db()).getAllFromIndex('photos', 'event_id', eventId)).map(p => ({...p, url:p.data_url || URL.createObjectURL(p.blob),thumbnail:p.preview_url || URL.createObjectURL(p.preview || p.blob)}));
}
async function blobDataUrl(blob) {
  const bytes=new Uint8Array(await blob.arrayBuffer());let encoded='';
  for(let i=0;i<bytes.length;i+=32768)encoded+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return `data:${blob.type};base64,${btoa(encoded)}`;
}
export function revokePhotos(photos) { for (const photo of photos) for (const key of ['url', 'thumbnail']) if (photo[key]?.startsWith('blob:')) URL.revokeObjectURL(photo[key]); }
export async function savePhoto(event, file, preview, descriptors) {
  const id = crypto.randomUUID();
  const photo = {id, event_id: event.id, name: file.name, size: file.size + preview.size, descriptors, face_count: descriptors.length, created_at: new Date().toISOString()};
  if (!cloudEnabled) {
    // Self-contained values also survive browser profiles that cannot restore native File handles.
    const [data_url,preview_url]=await Promise.all([blobDataUrl(file),blobDataUrl(preview)]);
    await (await db()).put('photos', {...photo,data_url,preview_url}); return;
  }
  const extension = {'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp'}[file.type];
  const auth=await adminRequest('/api/admin/imagekit/auth',{method:'POST',body:JSON.stringify({eventId:event.id,photoId:id,extension})});
  const form=new FormData();form.append('file',file);
  for(const [key,value] of Object.entries(auth))form.append(key,String(value));
  form.append('isPrivateFile','true');form.append('useUniqueFileName','false');form.append('overwriteFile','false');form.append('responseFields','isPrivateFile');
  const uploaded=await fetch('https://upload.imagekit.io/api/v1/files/upload',{method:'POST',body:form});
  const asset=await uploaded.json();if(!uploaded.ok)throw new Error(asset.message||'ImageKit upload failed.');
  // Finalization is verified against ImageKit by the server; never trust browser paths.
  await adminRequest('/api/admin/photos',{method:'POST',body:JSON.stringify({id,event_id:event.id,name:file.name,descriptors,fileId:asset.fileId})});
}
export async function removePhoto(photo) {
  if (!cloudEnabled) { await (await db()).delete('photos', photo.id); return; }
  await adminRequest(`/api/admin/photos?id=${photo.id}`,{method:'DELETE'});
}
export async function deleteEvent(event) {
  const photos = await getPhotos(event.id);
  try { for (const photo of photos) await removePhoto(photo); } finally { revokePhotos(photos); }
  if (cloudEnabled) checked(await supabase.from('events').delete().eq('id', event.id));
  else await (await db()).delete('events', event.id);
}
export async function getGuestEvent(token) {
  if (cloudEnabled) { const res = await fetch(`/api/events/${token}`, {cache: 'no-store'}); const data = await res.json(); if (!res.ok) throw new Error(data.error); return data; }
  const event = (await listEvents()).find(e => e.token === token);
  if (!event || event.status !== 'live') throw new Error('This gallery is not available. Please contact your photographer.');
  return event;
}
export async function findMatches(token, descriptor) {
  if (cloudEnabled) {
    const res = await fetch(`/api/events/${token}/match`, {method:'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({descriptor, consent: true})});
    const data = await res.json(); if (!res.ok) throw new Error(data.error); return data.photos;
  }
  const event = await getGuestEvent(token);
  const photos = await getPhotos(event.id);
  const matches = matchPhotos(photos, descriptor);
  revokePhotos(photos.filter(p => !matches.some(m => m.id === p.id))); return matches;
}
