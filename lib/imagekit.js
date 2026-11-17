import ImageKit from '@imagekit/nodejs';
export function imagekitClient() {
  if (!process.env.IMAGEKIT_PRIVATE_KEY || !process.env.IMAGEKIT_URL_ENDPOINT || !process.env.IMAGEKIT_PUBLIC_KEY) throw new Error('ImageKit is not configured. Add its keys and URL endpoint on the server.');
  return new ImageKit({privateKey:process.env.IMAGEKIT_PRIVATE_KEY,maxRetries:1,timeout:30000});
}
export function imagekitPhotoUrls(photo,expiresIn=600) {
  const client=imagekitClient();
  const options={urlEndpoint:process.env.IMAGEKIT_URL_ENDPOINT,src:`/${photo.path}`,signed:true,expiresIn};
  return {id:photo.id,name:photo.name,size:photo.size,face_count:photo.face_count,created_at:photo.created_at,event_id:photo.event_id,
    url:client.helper.buildSrc({...options,transformation:[{original:true}]}),
    thumbnail:client.helper.buildSrc({...options,transformation:[{width:720,quality:78}]})};
}
export async function removeImagekitFile(fileId) {
  try {await imagekitClient().files.delete(fileId);} catch(error) {if(error.status!==404)throw error;}
}
