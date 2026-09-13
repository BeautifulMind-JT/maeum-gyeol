import {newId} from './identity.mjs';
import {normalizeRecord} from './storage.mjs';
import {fromServer} from './sync-journal.mjs';

const copy=value=>structuredClone(value);
function draftValue(value){if(!value)return null;const normalized=normalizeRecord(value,{draft:true});delete normalized.updatedAt;return {...normalized,entryRevision:Number(value.entryRevision??value.revision)||0,visibility:value.visibility==='public'?'public':'private'};}
const fingerprint=value=>JSON.stringify(value);
const rejected=error=>error.status>=400&&error.status<500&&error.status!==408;
const conflict=(kind)=>Object.assign(Error(kind==='draft'?'다른 기기에서 작성 중인 글이 바뀌었어요. 필요한 내용을 복사한 뒤 서버의 글을 다시 열어주세요.':'다른 기기에서 이 기록이 바뀌었어요. 필요한 내용을 복사한 뒤 다시 열어주세요.'),{code:kind==='draft'?'DRAFT_CONFLICT':'RECORD_CONFLICT'});

// Only transient request state lives here. There is deliberately no disk adapter.
export function createServerJournal(remote){
 let queue=Promise.resolve(),draftRow=null,draftLoaded=false,draftConflict=false,pendingDraft=null;
 const entries=new Map(),pendingEntries=new Map();
 const serial=fn=>{const next=queue.then(fn);queue=next.catch(()=>{});return next;};
 async function readDraft(){draftRow=await remote.loadDraft();draftLoaded=true;return draftRow;}
 async function sendDraft(){
  const sent=pendingDraft;let result;try{result=await remote.commitDraft(sent);}catch(e){if(rejected(e))pendingDraft=null;throw e;}
  pendingDraft=null;
  if(result.status!=='applied'){draftConflict=true;throw conflict('draft');}
  draftRow=result.draft;draftLoaded=true;return draftRow;
 }
 async function storeDraft(value){
  const next=draftValue(value),key=fingerprint(next);
  if(draftConflict)throw conflict('draft');
  if(pendingDraft)await sendDraft();
  if(!draftLoaded)await readDraft();
  if(fingerprint(draftValue(draftRow?.payload))===key)return copy(next);
  pendingDraft={revision:Number(draftRow?.revision)||0,mutationId:newId(),payload:next};
  await sendDraft();return copy(next);
 }
 async function sendEntry(sent){
  let result;try{result=await remote.save(sent.record,sent.draftRevision);}catch(e){if(rejected(e))pendingEntries.delete(sent.record.id);throw e;}
  if(result.status!=='applied'){
   pendingEntries.delete(sent.record.id);
   if(result.status==='draft_conflict'){draftConflict=true;throw conflict('draft');}
   throw conflict('record');
  }
  const row=fromServer(result.entry);entries.set(row.id,row);pendingEntries.delete(row.id);
  if(sent.draftRevision!==null){draftRow=result.draft;draftLoaded=true;}
  return row;
 }
 async function write(value,{finishDraft=false}={}){
  let r={...normalizeRecord(value,{draft:value.deleted}),visibility:value.visibility==='public'?'public':'private',deleted:value.deleted===true,
   revision:Number(value.entryRevision??value.revision??entries.get(value.id)?.revision)||0};
  const key=fingerprint(r),pending=pendingEntries.get(r.id);
  if(pending){const applied=await sendEntry(pending);if(pending.key===key)return copy(applied);r.revision=applied.revision;}
  const sent={key,record:{...r,mutationId:newId()},draftRevision:finishDraft?Number(draftRow?.revision)||0:null};
  pendingEntries.set(r.id,sent);return copy(await sendEntry(sent));
 }
 const api={
  list:()=>serial(async()=>{const rows=(await remote.pull()).map(fromServer);entries.clear();for(const r of rows)entries.set(r.id,r);return rows.filter(r=>!r.deleted).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));}),
  draft:()=>serial(async()=>{if(!draftLoaded)await readDraft();return copy(draftValue(draftRow?.payload));}),
  reloadDraft:()=>serial(async()=>{const row=await readDraft();pendingDraft=null;draftConflict=false;return copy(draftValue(row?.payload));}),
  storeDraft:r=>serial(()=>storeDraft(copy(r))),
  save:r=>serial(()=>write(copy(r))),
  finish:r=>serial(async()=>{if(draftConflict)throw conflict('draft');if(!draftLoaded)await readDraft();return write(copy(r),{finishDraft:true});}),
  remove:id=>serial(async()=>{const r=entries.get(id);if(!r||r.deleted)throw Error('기록을 다시 열어주세요.');return write({...r,note:'',context:'',wineName:'',vintage:'',conversation:[],photoPath:null,seconds:0,featured:false,deleted:true,visibility:'private'});}),
  publish:(id,visibility)=>serial(async()=>{if(!['private','public'].includes(visibility))throw Error('공개 범위를 확인해주세요.');const r=entries.get(id);if(!r||r.deleted)throw Error('기록을 다시 열어주세요.');return write({...r,visibility});}),
  sync:async()=>{await api.list();return {conflicts:0,pending:0};},
  pending:async()=>Number(Boolean(pendingDraft))+pendingEntries.size,
  hasPending:()=>Boolean(pendingDraft)||pendingEntries.size>0,
  clear:()=>serial(async()=>{entries.clear();pendingEntries.clear();draftRow=null;draftLoaded=false;pendingDraft=null;draftConflict=false;}),
  migrate:(adapter,options)=>serial(()=>migrateLegacy(adapter,remote,options).then(result=>{draftLoaded=false;return result;}))
 };
 return api;
}

async function stableCopyId(owner,record){
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(owner+'\n'+fingerprint(record)))).slice(0,16);
 bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
 const h=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');
}
// Upgrade the old device store only after every server acknowledgement.
// Stable copy IDs make retries safe even when the app closes halfway through.
export async function migrateLegacy(adapter,remote,{owner,account=false}={}){
 const raw=await adapter.read();if(!raw)return {count:0};
 const state=JSON.parse(raw);if(![1,2].includes(state.version)||!Array.isArray(state.entries))throw Error('이전 기록을 읽지 못했어요. 원본은 보존했어요.');
 const server=new Map((await remote.pull()).map(r=>[r.id,r]));let count=0;const migrated=new Map();
 for(const value of state.entries){
  const existing=server.get(value.id);
  if(account&&!value.dirty&&existing)continue;
  if(!account&&existing)continue;
  if(value.deleted&&!existing)continue;
  const r={...normalizeRecord(value,{draft:value.deleted}),visibility:account&&value.visibility==='public'?'public':'private',deleted:value.deleted===true,
   revision:account?Number(value.revision)||0:0,mutationId:value.mutationId||await stableCopyId(owner,value)};
  let result=await remote.commit(r);
  if(result.status!=='applied'){
   if(r.deleted)throw Error('다른 기기에서 변경된 기록이 있어 이전 삭제 요청을 확인해야 해요. 원본은 보존했어요.');
   const id=await stableCopyId(owner,value);
   result=await remote.commit({...r,id,revision:0,mutationId:id,visibility:'private',featured:false});
  }
  if(result.status!=='applied')throw Error('이전 기록을 서버에 보관하지 못했어요. 원본은 보존했어요.');
  migrated.set(value.id,result.entry);count++;
 }
 if(state.draft){
  const previous=state.entries.find(r=>r.id===state.draft.id);const acknowledged=migrated.get(state.draft.id);const value=draftValue({...state.draft,id:acknowledged?.id||state.draft.id,entryRevision:acknowledged?.revision??state.draft.entryRevision??previous?.revision??0});const current=await remote.loadDraft();
  if(current?.payload&&fingerprint(draftValue(current.payload))!==fingerprint(value))throw Error('서버에서 작성하던 글을 먼저 마무리해주세요. 이전 기기의 초안은 보존했어요.');
  if(!current?.payload){const result=await remote.commitDraft({revision:Number(current?.revision)||0,mutationId:await stableCopyId(owner,value),payload:value});if(result.status!=='applied')throw Error('초안을 옮기지 못했어요. 원본은 보존했어요.');}
 }
 if(await adapter.read()!==raw)throw Error('이전 앱에서 기록이 변경됐어요. 이전 앱을 닫고 다시 옮겨주세요.');
 await adapter.clear();return {count};
}
