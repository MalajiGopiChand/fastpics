import {withTimeout} from './image-input.mjs';
export function stopStream(stream){stream?.getTracks().forEach(track=>track.stop());}
export async function requestCamera(devices,timeout=20000){
 if(!devices?.getUserMedia)throw new Error('Live camera is unavailable in this browser. Use the phone camera button or upload a selfie.');
 let expired=false;
 const pending=devices.getUserMedia({video:{facingMode:{ideal:'user'},width:{ideal:1280},height:{ideal:1280}},audio:false}).then(stream=>{if(expired)stopStream(stream);return stream;});
 try{return await withTimeout(pending,timeout,'Camera permission is taking too long. Use the phone camera button or upload a selfie.');}
 catch(error){expired=true;if(error.name==='NotAllowedError'||error.name==='SecurityError')throw new Error('Camera permission was denied. Allow camera access in browser settings, or use the phone camera button.');if(error.name==='NotReadableError')throw new Error('The camera is busy in another app. Close that app, or upload a selfie.');throw error;}
}
