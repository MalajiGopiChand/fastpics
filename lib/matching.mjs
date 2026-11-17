export const MATCH_THRESHOLD = 0.48;
export function validDescriptor(value) {
  return Array.isArray(value) && value.length === 128 && value.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 2) && value.some(v => Math.abs(v) > 0.001);
}
export function distance(a, b) {
  if (!validDescriptor(a) || !validDescriptor(b)) return Infinity;
  return Math.sqrt(a.reduce((sum, value, i) => sum + (value - b[i]) ** 2, 0));
}
export function matchPhotos(photos, descriptor) {
  if (!validDescriptor(descriptor)) throw new Error('Invalid face descriptor');
  return photos.map(photo => ({...photo, distance: Math.min(...(photo.descriptors || []).map(face => distance(face, descriptor)))}))
    .filter(photo => photo.distance < MATCH_THRESHOLD).sort((a, b) => a.distance - b.distance);
}
