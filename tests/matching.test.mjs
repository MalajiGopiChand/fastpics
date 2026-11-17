import test from 'node:test';
import assert from 'node:assert/strict';
import { matchPhotos, validDescriptor, distance } from '../lib/matching.mjs';
const face = Array.from({length:128}, (_,i) => Math.sin(i)*0.1);
test('finds the person in solo and group photos, excluding other people and unindexed photos', () => {
  const stranger = face.map(v => v+0.2);
  const photos = [{id:'solo',descriptors:[face]}, {id:'group',descriptors:[stranger,face]}, {id:'other',descriptors:[stranger]}, {id:'empty',descriptors:[]}];
  assert.deepEqual(matchPhotos(photos,face).map(p => p.id),['solo','group']);
});
test('rejects malformed and non-finite vectors', () => {
  for (const value of [null,[],Array(128).fill(0),Array(128).fill(NaN),Array(128).fill(Infinity),Array(128).fill(3)]) assert.equal(validDescriptor(value),false);
  assert.throws(() => matchPhotos([],[]));
  assert.equal(distance(face,[]),Infinity);
});
test('threshold excludes weak matches and ranking puts closer faces first', () => {
  const close = face.map(v => v+0.01), far = face.map(v => v+0.05);
  assert.deepEqual(matchPhotos([{id:'close',descriptors:[close]},{id:'far',descriptors:[far]},{id:'exact',descriptors:[face]}],face).map(p => p.id),['exact','close']);
});
