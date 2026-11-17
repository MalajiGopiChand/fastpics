// Reads credentials through hidden stdin; never logs them or writes them to source.
import {readFile,writeFile} from 'node:fs/promises';
import ImageKit from '@imagekit/nodejs';
if(process.stdin.isTTY)process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');
console.log('Ready for ImageKit configuration JSON on hidden stdin.');
let buffer='';
process.stdin.on('data',async chunk=>{
  buffer+=chunk;if(!buffer.includes('\n')&&!buffer.includes('\r'))return;
  process.stdin.removeAllListeners('data');process.stdin.pause();
  if(process.stdin.isTTY)process.stdin.setRawMode(false);
  try {
    const input=JSON.parse(buffer.trim());buffer='';
    const fixture=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1nQAAAAASUVORK5CYII=','base64');
    let chosen=null;
    for(const key of input.privateKeys){
      let uploaded,client;
      try {
        client=new ImageKit({privateKey:key,maxRetries:0,timeout:20000});
        const auth=client.helper.getAuthenticationParameters(crypto.randomUUID(),Math.floor(Date.now()/1000)+300);
        const form=new FormData();form.append('file',new Blob([fixture],{type:'image/png'}),'connection-test.png');
        form.append('fileName',`fastpics-connection-${crypto.randomUUID()}.png`);form.append('folder','/fastpics-connection-check');form.append('isPrivateFile','true');form.append('publicKey',input.publicKey);form.append('responseFields','isPrivateFile');
        for(const [name,value] of Object.entries(auth))form.append(name,String(value));
        const response=await fetch('https://upload.imagekit.io/api/v1/files/upload',{method:'POST',body:form,signal:AbortSignal.timeout(30000)});
        if(!response.ok){console.log(`Candidate authentication did not pass (HTTP ${response.status}).`);continue;}
        uploaded=await response.json();
        const details=await client.files.get(uploaded.fileId);
        if(!details.isPrivateFile)throw new Error('Private upload verification failed.');
        const url=new URL(uploaded.url);const endpoint=url.origin+url.pathname.slice(0,-uploaded.filePath.length);
        const signed=client.helper.buildSrc({urlEndpoint:endpoint,src:uploaded.filePath,signed:true,expiresIn:120,transformation:[{original:true}]});
        const delivered=await fetch(signed,{signal:AbortSignal.timeout(30000)});if(!delivered.ok)throw new Error(`Signed delivery failed (${delivered.status}).`);
        const unsigned=await fetch(uploaded.url,{signal:AbortSignal.timeout(30000)});
        if(unsigned.ok)throw new Error('Unsigned original was accessible. Review ImageKit security settings.');
        chosen={key,endpoint};console.log(`Verified private upload, signed delivery and unsigned-original denial. Endpoint: ${endpoint}`);
      }catch(error){console.log(`Candidate verification failed: ${error.status||error.name||'error'}.`);}
      finally {if(uploaded?.fileId){await client.files.delete(uploaded.fileId);console.log('Removed temporary connection-test image.');}}
      if(chosen)break;
    }
    if(!chosen)throw new Error('No candidate passed the connection checks.');
    let env=await readFile('.env.local','utf8');
    for(const [name,value] of Object.entries({IMAGEKIT_PUBLIC_KEY:input.publicKey,IMAGEKIT_PRIVATE_KEY:chosen.key,IMAGEKIT_URL_ENDPOINT:chosen.endpoint})){
      const pattern=new RegExp(`^${name}=.*$`,'m');env=pattern.test(env)?env.replace(pattern,`${name}=${value}`):env+`\n${name}=${value}\n`;
    }
    await writeFile('.env.local',env);console.log('ImageKit configuration saved only to ignored .env.local.');
    process.exit(0);
  } catch(error){console.error(error.message);process.exit(1);}
});
