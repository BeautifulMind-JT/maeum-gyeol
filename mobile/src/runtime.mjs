const cap=globalThis.Capacitor;
export const native=Boolean(cap?.isNativePlatform?.());
const plugin=name=>native?cap.registerPlugin(name):null;
const Filesystem=plugin('Filesystem'),Browser=plugin('Browser'),Share=plugin('Share'),App=plugin('App'),TTS=plugin('TextToSpeech');
const storageDirectory=native&&cap.getPlatform()==='ios'?'LIBRARY_NO_CLOUD':'DATA';
async function existingFiles(){return (await Filesystem.readdir({path:'',directory:storageDirectory})).files.map(f=>f.name);}
export function createStorageAdapter(scope='guest'){
 if(!/^[a-z0-9-]+$/i.test(scope))throw Error('잘못된 저장 공간이에요.');
 const filename=scope==='guest'?'maeum-records-v1.json':`maeum-${scope}.json`,backup=scope==='guest'?'maeum-records-backup.json':`maeum-${scope}-backup.json`,webKey=scope==='guest'?'maeum-gyeol:mobile:v1':`maeum-gyeol:${scope}`;
 return {
 async read(){
  if(!native)return localStorage.getItem(webKey);
  const files=await existingFiles();
  if(!files.includes(filename)&&!files.includes(backup))return null;
  const path=files.includes(filename)?filename:backup;
  const raw=String((await Filesystem.readFile({path,directory:storageDirectory,encoding:'utf8'})).data);
  try{JSON.parse(raw);return raw;}catch(error){if(path===backup||!files.includes(backup))throw error;const recovered=String((await Filesystem.readFile({path:backup,directory:storageDirectory,encoding:'utf8'})).data);JSON.parse(recovered);return recovered;}

 },
 async clear(){
  if(!native){localStorage.removeItem(webKey);return;}
  const files=await existingFiles();
  for(const path of [filename,backup])if(files.includes(path))await Filesystem.deleteFile({path,directory:storageDirectory});
 },
 async write(value){
  if(!native){localStorage.setItem(webKey,value);return;}
  const files=await existingFiles();
  if(files.includes(filename)){const old=await Filesystem.readFile({path:filename,directory:storageDirectory,encoding:'utf8'});let valid=false;try{JSON.parse(old.data);valid=true;}catch{}if(valid)await Filesystem.writeFile({path:backup,directory:storageDirectory,encoding:'utf8',data:old.data});}
  await Filesystem.writeFile({path:filename,directory:storageDirectory,encoding:'utf8',data:value});
  await Filesystem.writeFile({path:backup,directory:storageDirectory,encoding:'utf8',data:value});
 }
};}
export const storageAdapter=createStorageAdapter();
export function createAuthStorage(){
 const adapter=createStorageAdapter('auth-v1');let queue=Promise.resolve();
 const run=fn=>{const p=queue.then(fn);queue=p.catch(()=>{});return p;};
 return {getItem:key=>run(async()=>JSON.parse(await adapter.read()||'{}')[key]??null),setItem:(key,value)=>run(async()=>{const v=JSON.parse(await adapter.read()||'{}');v[key]=value;await adapter.write(JSON.stringify(v));}),removeItem:key=>run(async()=>{const v=JSON.parse(await adapter.read()||'{}');delete v[key];await adapter.write(JSON.stringify(v));})};
}
export async function openCommunity(){const url='https://maeum-gyeol.pages.dev/mobile/#together';if(native)await Browser.open({url});else window.open(url,'_blank','noopener,noreferrer');}
export async function shareMoment(text){if(native){await Share.share({title:'마음결 · 내가 알아차린 순간',text,dialogTitle:'이 순간 나누기'});return;}if(navigator.share){await navigator.share({title:'마음결',text});return;}await navigator.clipboard.writeText(text);return 'copied';}
export async function savePhoto(blob,id){
 const name='maeum-photo-'+id+'.jpg';
 if(native){const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});const file=await Filesystem.writeFile({path:name,directory:'CACHE',data});await Share.share({title:'마음결 사진',files:[file.uri]});return;}
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export async function exportJournal(value){
 const text=JSON.stringify(value,null,2),name='maeum-gyeol-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
 if(native){const file=await Filesystem.writeFile({path:name,directory:'CACHE',encoding:'utf8',data:text});await Share.share({title:'마음결 기록 백업',files:[file.uri],dialogTitle:'내 기록 파일 저장'});return;}
 const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
let speechEpoch=0;
export function stopSpeech(){speechEpoch++;if(native)TTS.stop().catch(()=>{});else globalThis.speechSynthesis?.cancel();}
export async function speak(text){
 const epoch=++speechEpoch;
 if(native){await TTS.stop();if(epoch!==speechEpoch)return;await TTS.speak({text,lang:'ko-KR',rate:0.9,pitch:1,volume:1,category:'playback'});return;}
 if(!globalThis.speechSynthesis)throw Error('이 기기에서는 화면 안내로 따라가주세요.');
 speechSynthesis.cancel();
 await new Promise((resolve,reject)=>{const u=new SpeechSynthesisUtterance(text);u.lang='ko-KR';u.rate=0.94;const voice=speechSynthesis.getVoices().find(v=>v.lang.startsWith('ko')&&v.localService);if(voice)u.voice=voice;u.onend=resolve;u.onerror=e=>['canceled','interrupted'].includes(e.error)?resolve():reject(Error('음성을 재생하지 못했어요. 화면 안내는 계속돼요.'));speechSynthesis.speak(u);});
}
export async function bindLifecycle({pause,back}){
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
 window.addEventListener('pagehide',pause);
 if(native){await App.addListener('appStateChange',s=>{if(!s.isActive)pause();});if(cap.getPlatform()==='android')await App.addListener('backButton',back);}
}
export async function minimize(){if(native&&cap.getPlatform()==='android')await App.minimizeApp();}
