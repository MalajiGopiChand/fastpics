import { mkdir, copyFile, readdir } from 'node:fs/promises';
await mkdir('public/models', { recursive: true });
const root = 'node_modules/@vladmandic/face-api';
for (const file of await readdir(`${root}/model`)) {
  if (/^(ssd_mobilenetv1|face_landmark_68_model|face_recognition_model)/.test(file)) await copyFile(`${root}/model/${file}`, `public/models/${file}`);
}
await copyFile(`${root}/dist/face-api.js`, 'public/face-api.js');
console.log('Bundled face engine and recognition models locally.');
