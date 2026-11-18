import {decodeImage,imageCanvas,jpegBlob,withTimeout} from './image-input.mjs';
import {validDescriptor} from './matching.mjs';
let enginePromise;
let analysisQueue=Promise.resolve();
export function loadFaceEngine(onProgress=()=>{}) {
 onProgress('Loading face recognition. The first scan may take a minute…');
 if(!enginePromise)enginePromise=(async()=>{
  if(!window.faceapi)await new Promise((resolve,reject)=>{
   const script=document.createElement('script');let timer;
   const fail=()=>{clearTimeout(timer);script.remove();reject(new Error('Face recognition could not load. Check your connection and retry.'));};
   script.src='/face-api.js';script.onload=()=>{clearTimeout(timer);resolve();};script.onerror=fail;timer=setTimeout(fail,30000);document.head.appendChild(script);
  });
  const api=window.faceapi;if(!api?.tf)throw new Error('Face recognition did not start. Reload this page.');
  try{await api.tf.ready();}catch{await api.tf.setBackend('cpu');await api.tf.ready();}
  await Promise.all([api.nets.ssdMobilenetv1.loadFromUri('/models'),api.nets.faceLandmark68Net.loadFromUri('/models'),api.nets.faceRecognitionNet.loadFromUri('/models')]);
  return api;
 })().catch(error=>{enginePromise=null;throw error;});
 return withTimeout(enginePromise,90000,'Face models are taking too long to download. Use a stable connection and retry; if it continues, reload the page.');
}
export function analyzeFace(blob,{onProgress=()=>{}}={}){
 const job=analysisQueue.then(async()=>{
  const api=await loadFaceEngine(onProgress);onProgress('Opening your photo…');
  const decoded=await decodeImage(blob);
  try{
   const canvas=imageCanvas(decoded.image,1600);onProgress('Scanning faces. Keep this page open…');
   const detect=()=>api.detectAllFaces(canvas,new api.SsdMobilenetv1Options({minConfidence:0.5,maxResults:50})).withFaceLandmarks().withFaceDescriptors();
   let faces;
   try{faces=await detect();}catch(error){
    if(api.tf.getBackend()==='cpu')throw error;
    onProgress('Using compatible scanning mode. This may be slower…');await api.tf.setBackend('cpu');await api.tf.ready();faces=await detect();
   }
   const descriptors=faces.map(face=>Array.from(face.descriptor));
   if(descriptors.some(d=>!validDescriptor(d)))throw new Error('Face scanning returned invalid data. Please reload and try a clearer photo.');
   return descriptors;
  }finally{decoded.release();}
 });
 // Do not overlap inference or backend switches after a caller times out.
 analysisQueue=job.catch(()=>{});
 return withTimeout(job,150000,'Scanning took too long on this device. Try a smaller photo in Safari or Chrome, or reload the page.');
}
export async function previewImage(blob){const decoded=await decodeImage(blob);try{return await jpegBlob(imageCanvas(decoded.image,720));}finally{decoded.release();}}
