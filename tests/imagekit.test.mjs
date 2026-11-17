import test from 'node:test';
import assert from 'node:assert/strict';
import {imagekitPhotoUrls} from '../lib/imagekit.js';
test('ImageKit original and preview links are signed, expire, and never expose keys or face data',()=>{
  process.env.IMAGEKIT_PRIVATE_KEY='private_test_not_a_real_key';
  process.env.IMAGEKIT_PUBLIC_KEY='public_test';
  process.env.IMAGEKIT_URL_ENDPOINT='https://ik.imagekit.io/test_studio';
  const before=Math.floor(Date.now()/1000);
  const result=imagekitPhotoUrls({id:'photo1',name:'moment.jpg',path:'owner/event/photo.jpg',descriptors:[[1,2,3]]},600);
  for(const key of ['url','thumbnail']){
    const url=new URL(result[key]);
    assert.equal(url.hostname,'ik.imagekit.io');
    assert.match(url.searchParams.get('ik-s'),/^[a-f0-9]{40}$/);
    assert.ok(Number(url.searchParams.get('ik-t'))>=before+600);
    assert.ok(!result[key].includes('private_test'));
  }
  assert.match(result.url,/orig-true/);
  assert.match(result.thumbnail,/w-720/);
  assert.equal('descriptors' in result,false);
});
