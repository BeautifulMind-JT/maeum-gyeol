import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './db-fixture.mjs';
import {createServerJournal,migrateLegacy} from '../mobile/src/server-journal.mjs';

const fresh=()=>({id:crypto.randomUUID(),date:new Date().toISOString(),note:'지금 손에 닿는 잔의 온기.',wineName:'',vintage:'',context:'',stage:'finish',seconds:180,conversation:[]});

test('server-only journals keep drafts private and acknowledge durable writes',async t=>{
 const {db,as,user}=await database();const owner=await user(),other=await user();
 const remote=uid=>({
  pull:()=>as(uid,async()=>(await db.query('select * from public.mg_entries order by id')).rows),
  loadDraft:()=>as(uid,async()=>(await db.query('select * from public.mg_drafts')).rows[0]||null),
  commitDraft:r=>as(uid,async()=>(await db.query('select public.mg_commit_draft($1,$2,$3) as r',[r.revision,r.mutationId,r.payload===null?null:JSON.stringify(r.payload)])).rows[0].r),
  commit:r=>as(uid,async()=>(await db.query('select public.mg_commit_entry($1,$2,$3,$4) as r',[r.id,r.revision,r.mutationId,JSON.stringify(r)])).rows[0].r),
  save:(r,rev)=>as(uid,async()=>(await db.query('select public.mg_save_entry($1,$2,$3,$4,$5) as r',[r.id,r.revision,r.mutationId,JSON.stringify(r),rev])).rows[0].r)
 });
 const r=remote(owner);let draft;
 try{
  await t.test('unfinished text is private and cannot bypass the draft RPC',async()=>{
   const j=createServerJournal(r);draft={...fresh(),note:'',vintage:'20',conversation:[{role:'you',text:'나만의 생각'}]};
   await j.storeDraft(draft);
   assert.equal((await r.loadDraft()).payload.vintage,'20');
   assert.equal((await remote(other).loadDraft()),null);
   await as(null,()=>assert.rejects(db.query('select * from public.mg_drafts'),e=>e.code==='42501'));
   await as(owner,()=>assert.rejects(db.query("update public.mg_drafts set payload='{}'"),e=>e.code==='42501'));
   await as(owner,()=>assert.rejects(db.query('delete from public.mg_drafts'),e=>e.code==='42501'));
   await assert.rejects(remote(null).commitDraft({revision:0,mutationId:crypto.randomUUID(),payload:fresh()}),e=>e.code==='42501');
   assert.equal((await as(null,()=>db.query('select * from public.mg_public_entries'))).rows.length,0);
  });
  await t.test('a lost draft acknowledgement retries the same mutation',async()=>{
   let lost=true;const j=createServerJournal({...r,commitDraft:async sent=>{const result=await r.commitDraft(sent);if(lost){lost=false;throw Error('connection lost');}return result;}});
   draft={...draft,note:'느낀 것을 적기',vintage:''};await j.draft();
   await assert.rejects(j.storeDraft(draft),/connection lost/);
   const revision=(await r.loadDraft()).revision;
   await j.storeDraft(draft);
   assert.equal((await r.loadDraft()).revision,revision);
  });
  await t.test('two devices cannot silently overwrite each other’s drafts',async()=>{
   const first=createServerJournal(r),second=createServerJournal(r);await first.draft();await second.draft();
   await first.storeDraft({...draft,note:'첫 기기에서 이어 쓴 내용'});
   await assert.rejects(second.storeDraft({...draft,note:'오래된 화면의 내용'}),e=>e.code==='DRAFT_CONFLICT');
   assert.equal((await r.loadDraft()).payload.note,'첫 기기에서 이어 쓴 내용');
   draft=await first.draft();
  });
  await t.test('final save and draft retirement are atomic, including a lost reply',async()=>{
   let lost=true;const j=createServerJournal({...r,save:async(...args)=>{const result=await r.save(...args);if(lost){lost=false;throw Error('reply lost');}return result;}});
   draft=await j.draft();await assert.rejects(j.finish(draft),/reply lost/);
   assert.equal((await r.loadDraft()).payload,null);
   const saved=await j.finish(draft);
   assert.equal(saved.note,draft.note);assert.equal((await r.pull()).length,1);
   const anotherDevice=createServerJournal(r);assert.equal((await anotherDevice.list())[0].id,saved.id);
   assert.equal(await anotherDevice.draft(),null);
  });
  await t.test('offline failure never reports a save or discards the server draft',async()=>{
   let offline=true;const j=createServerJournal({...r,save:(...args)=>{if(offline)throw Error('offline');return r.save(...args);}});
   const value=fresh();await j.storeDraft(value);const before=(await r.pull()).length;
   await assert.rejects(j.finish(value),/offline/);
   assert.equal((await r.pull()).length,before);assert.equal((await r.loadDraft()).payload.id,value.id);
   offline=false;await j.finish(value);assert.equal((await r.pull()).length,before+1);
  });
  await t.test('stale record or draft revisions cannot overwrite newer server data',async()=>{
   const first=createServerJournal(r),second=createServerJournal(r);const [old]=await second.list();await first.list();
   await first.save({...old,note:'서버의 최신 기록'});
   await assert.rejects(second.save({...old,note:'오래된 기록'}),e=>e.code==='RECORD_CONFLICT');
   const value=fresh();await first.storeDraft(value);await second.reloadDraft();
   await first.storeDraft({...value,note:'초안의 최신 내용'});
   const count=(await r.pull()).length;
   await assert.rejects(second.finish(value),e=>e.code==='DRAFT_CONFLICT');
   assert.equal((await r.pull()).length,count);
   assert.equal((await r.loadDraft()).payload.note,'초안의 최신 내용');
   await first.storeDraft(null);
  });
  await t.test('foreign photos and oversized drafts are rejected by the database',async()=>{
   const current=await r.loadDraft();const send=payload=>r.commitDraft({revision:current.revision,mutationId:crypto.randomUUID(),payload});
   await assert.rejects(send({...fresh(),photoPath:other+'/'+crypto.randomUUID()}),e=>e.code==='42501');
   await assert.rejects(send({...fresh(),note:'a'.repeat(1601)}),/too long/);
   assert.equal((await r.loadDraft()).revision,current.revision);
  });
  await t.test('device migration clears originals only after acknowledged, repeatable transfers',async()=>{
   const value=fresh();let raw=JSON.stringify({version:1,entries:[value],draft:null}),cleared=false,lost=true;
   const adapter={read:async()=>raw,clear:async()=>{raw=null;cleared=true;}};
   const interrupted={...r,commit:async sent=>{const result=await r.commit(sent);if(lost){lost=false;throw Error('reply lost');}return result;}};
   await assert.rejects(migrateLegacy(adapter,interrupted,{owner}),/reply lost/);assert.equal(cleared,false);
   await migrateLegacy(adapter,r,{owner});assert.equal(cleared,true);
   assert.equal((await r.pull()).filter(e=>e.id===value.id).length,1);
  });
  await t.test('a competing server draft preserves the old device copy for later recovery',async()=>{
   const j=createServerJournal(r);await j.storeDraft(fresh());
   let raw=JSON.stringify({version:1,entries:[],draft:fresh()});const original=raw;
   await assert.rejects(migrateLegacy({read:async()=>raw,clear:async()=>{raw=null;}},r,{owner}),/먼저 마무리/);
   assert.equal(raw,original);
  });
 }finally{await db.close();}
});

test('definite validation rejection does not trap corrected drafts in an invalid retry',async()=>{
 let row=null,calls=0;
 const j=createServerJournal({loadDraft:async()=>row,commitDraft:async r=>{calls++;if(r.payload.note==='rejected')throw Object.assign(Error('invalid'),{status:400});return {status:'applied',draft:row={revision:(row?.revision||0)+1,payload:r.payload}};}});
 await assert.rejects(j.storeDraft({...fresh(),note:'rejected'}),/invalid/);
 assert.equal(j.hasPending(),false);
 await j.storeDraft({...fresh(),note:'corrected'});
 assert.equal(row.payload.note,'corrected');assert.equal(calls,2);
});

test('migrating a dirty account record carries its acknowledged revision into its draft',async()=>{
 const {db,as,user,commit}=await database();const owner=await user();
 try{
  const v=fresh();const original=(await commit(owner,v,0,v.id)).entry;
  const remote={pull:()=>as(owner,async()=>(await db.query('select * from public.mg_entries')).rows),loadDraft:()=>as(owner,async()=>(await db.query('select * from public.mg_drafts')).rows[0]||null),commit:r=>commit(owner,r,r.revision,r.id,r.mutationId),commitDraft:r=>as(owner,async()=>(await db.query('select public.mg_commit_draft($1,$2,$3) r',[r.revision,r.mutationId,JSON.stringify(r.payload)])).rows[0].r)};
  let raw=JSON.stringify({version:2,entries:[{...v,revision:original.revision,dirty:true,note:'older-device edit'}],draft:{...v,note:'still writing'}});
  await migrateLegacy({read:async()=>raw,clear:async()=>{raw=null;}},remote,{owner,account:true});
  const latest=(await remote.pull())[0];assert.equal((await remote.loadDraft()).payload.entryRevision,latest.revision);assert.equal(raw,null);
 }finally{await db.close();}
});
