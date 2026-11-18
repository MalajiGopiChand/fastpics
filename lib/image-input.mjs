export async function decodeImage(blob) {
 const url=URL.createObjectURL(blob);
 try {
  const img=await new Promise((resolve,reject)=>{
   const image=new Image();const timer=setTimeout(()=>{image.src='';reject(new Error('This image took too long to open. Try a smaller JPG selfie.'));},20000);
   image.onload=()=>{clearTimeout(timer);resolve(image);};image.onerror=()=>{clearTimeout(timer);reject(new Error('This image could not be opened. Use JPG, PNG or WebP; export HEIC photos as JPG first.'));};image.src=url;
  });
  return {image:img,release:()=>URL.revokeObjectURL(url)};
 }catch(error){URL.revokeObjectURL(url);throw error;}
}
export function imageCanvas(image,maxSize=1600){
 const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
 if(!width||!height)throw new Error('The image is empty. Take another photo.');
 const scale=Math.min(1,maxSize/Math.max(width,height));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
 const context=canvas.getContext('2d');if(!context)throw new Error('Your browser could not prepare the photo. Try opening the link in Safari or Chrome.');
 context.drawImage(image,0,0,canvas.width,canvas.height);return canvas;
}
export function jpegBlob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not prepare this image. Try another JPG photo.')),'image/jpeg',0.85));}
export function withTimeout(promise,ms,message){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),ms);})]).finally(()=>clearTimeout(timer));}
