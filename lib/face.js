let enginePromise;
export function loadFaceEngine() {
  if (!enginePromise) enginePromise = (async () => {
    if (!window.faceapi) await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/face-api.js'; script.onload = resolve; script.onerror = () => { script.remove(); reject(new Error('Could not load the face engine. Check your connection and retry.')); };
      document.head.appendChild(script);
    });
    const api = window.faceapi;
    await api.tf.ready();
    await Promise.all([api.nets.ssdMobilenetv1.loadFromUri('/models'), api.nets.faceLandmark68Net.loadFromUri('/models'), api.nets.faceRecognitionNet.loadFromUri('/models')]);
    return api;
  })().catch(error => { enginePromise = null; throw error; });
  return enginePromise;
}
export async function analyzeFace(blob) {
  const api = await loadFaceEngine();
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('This image could not be opened. Use JPEG, PNG or WebP.')); image.src = url; });
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
    canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const faces = await api.detectAllFaces(canvas, new api.SsdMobilenetv1Options({ minConfidence: 0.6, maxResults: 50 })).withFaceLandmarks().withFaceDescriptors();
    return faces.map(face => Array.from(face.descriptor));
  } finally { URL.revokeObjectURL(url); }
}
export async function previewImage(blob) {
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, 720 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.78));
  } finally { bitmap.close(); }
}
