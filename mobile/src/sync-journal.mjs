import {newId} from './identity.mjs';
import {normalizeRecord} from './storage.mjs';
const empty=()=>({version:2,entries:[],draft:null});
export function fromServer(r){
 return {...normalizeRecord({id:r.id,date:r.created_at,updatedAt:r.updated_at,note:r.note,context:r.context,wineName:r.wine_name,vintage:r.vintage,stage:r.stage,seconds:r.seconds,conversation:r.conversation,photoPath:r.photo_path,commentsEnabled:r.comments_enabled,featured:r.featured},{draft:r.deleted}),visibility:r.visibility,deleted:r.deleted,revision:Number(r.revision),mutationId:r.mutation_id,dirty:false};
}
export function createSyncedJournal(adapter,remote){
 let queue=Promise.resolve(),inflight=null;
 const serial=fn=>{const p=queue.then(fn);queue=p.catch(()=>{});return p;};
 async function read(){const raw=await adapter.read();if(!raw)return empty();const s=JSON.parse(raw);if(s.version!==2||!Array.isArray(s.entries))throw Error('계정 기록을 읽지 못했어요. 저장된 내용은 보존했어요.');return s;}
 const change=fn=>serial(async()=>{const s=await read();const result=fn(s);await adapter.write(JSON.stringify(s));return result;});
 function dirty(r,old){return {...normalizeRecord(r),visibility:old?.visibility||'private',deleted:false,revision:old?.revision||0,mutationId:newId(),dirty:true,updatedAt:new Date().toISOString()};}
 async function pushAll(){
  const pending=await serial(async()=>(await read()).entries.filter(e=>e.dirty));let conflicts=0;
  for(const sent of pending){
   const result=await remote.commit(sent);
   await change(s=>{
    const i=s.entries.findIndex(e=>e.id===sent.id);if(i<0)return;
    const latest=s.entries[i];const same=latest.mutationId===sent.mutationId;
    if(result.status==='applied'){
     const server=fromServer(result.entry);
     s.entries[i]=same?server:{...latest,revision:server.revision};
    }else if(['conflict','missing'].includes(result.status)){
     if(!latest.deleted){s.entries.push({...dirty({...latest,id:newId()},null),conflictOf:latest.id});conflicts++;}
     if(result.entry)s.entries[i]=fromServer(result.entry);else s.entries.splice(i,1);
    }else throw Error('서버 저장 상태를 확인하지 못했어요.');
   });
  }
  return conflicts;
 }
 async function synchronize(){
  let conflicts=await pushAll();
  // A conflict copy is private and gets a new identity; never resurrect a tombstone.
  if(conflicts)await pushAll();
  const rows=await remote.pull();
  await change(s=>{for(const raw of rows){const server=fromServer(raw),i=s.entries.findIndex(e=>e.id===server.id);if(i<0)s.entries.push(server);else if(!s.entries[i].dirty&&s.entries[i].revision<=server.revision)s.entries[i]=server;}});
  return {conflicts,pending:await serial(async()=>(await read()).entries.filter(e=>e.dirty).length)};
 }
 const api={
  list:()=>serial(async()=>(await read()).entries.filter(e=>!e.deleted).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date))),
  draft:()=>serial(async()=>(await read()).draft),
  storeDraft:r=>change(s=>{s.draft=r?{...normalizeRecord(r,{draft:true}),visibility:s.entries.find(e=>e.id===r.id)?.visibility||'private'}:null;}),
  save:r=>change(s=>{const i=s.entries.findIndex(e=>e.id===r.id),old=s.entries[i];const next=old?.deleted?{...dirty({...r,id:newId()},null),conflictOf:r.id}:dirty(r,old);if(i<0||old?.deleted)s.entries.push(next);else s.entries[i]=next;if(s.draft?.id===r.id)s.draft=null;return next;}),
  remove:id=>change(s=>{const i=s.entries.findIndex(e=>e.id===id);if(i<0)return;s.entries[i]={...s.entries[i],note:'',context:'',wineName:'',vintage:'',photoPath:null,featured:false,conversation:[],seconds:0,deleted:true,visibility:'private',dirty:true,mutationId:newId()};if(s.draft?.id===id)s.draft=null;}),
  publish:(id,visibility)=>change(s=>{if(!['private','public'].includes(visibility))throw Error('공개 범위를 확인해주세요.');const r=s.entries.find(e=>e.id===id&&!e.deleted);if(!r||!r.revision||r.dirty)throw Error('기록을 서버에 저장한 뒤 공개 범위를 변경해주세요.');r.visibility=visibility;r.dirty=true;r.mutationId=newId();}),
  export:()=>serial(async()=>{const s=await read();return {app:'maeum-gyeol-mobile',version:1,exportedAt:new Date().toISOString(),entries:s.entries.filter(e=>!e.deleted).map(e=>normalizeRecord(e)),draft:s.draft};}),
  import:raw=>change(s=>{const v=JSON.parse(raw);if(v.app!=='maeum-gyeol-mobile'||v.version!==1||!Array.isArray(v.entries))throw Error('마음결 백업 파일을 선택해주세요.');const incoming=v.entries.map(r=>normalizeRecord(r));let count=0;for(const r of incoming){if(!s.entries.some(e=>e.id===r.id)){s.entries.push(dirty(r,null));count++;}}return count;}),
  clear:()=>serial(()=>adapter.write(JSON.stringify(empty()))),
  pending:()=>serial(async()=>(await read()).entries.filter(e=>e.dirty).length),
  sync:()=>{if(!inflight)inflight=synchronize().finally(()=>inflight=null);return inflight;}
 };
 return api;
}
