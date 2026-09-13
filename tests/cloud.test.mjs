import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './db-fixture.mjs';
import {createSyncedJournal} from '../mobile/src/sync-journal.mjs';
const a=crypto.randomUUID(),b=crypto.randomUUID();
const fresh=()=>({id:crypto.randomUUID(),date:new Date().toISOString(),wineName:'폴리지아노',vintage:'2021',context:'창가',note:'향을 맞히려는 생각을 알아차렸다.',stage:'aroma',seconds:180,conversation:[{role:'you',text:'개인적인 돌아보기 답변'}]});
function memory(){let raw=null;return {read:async()=>raw,write:async v=>{raw=v;}};}
test('real PostgreSQL policies, publication and two-device sync preserve private records',async t=>{
 const {db}=await database();
 await db.query('insert into auth.users values($1),($2)',[a,b]);
 async function as(uid,fn,role='authenticated'){await db.exec('set role '+role);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid||'']);try{return await fn();}finally{await db.exec('reset role');}}
 const commit=(uid,r)=>as(uid,async()=>(await db.query('select public.mg_commit_entry($1,$2,$3,$4) as result',[r.id,r.revision,r.mutationId,JSON.stringify(r)])).rows[0].result);
 const pull=uid=>as(uid,async()=>(await db.query('select * from public.mg_entries where owner_id=$1 order by id',[uid])).rows);
 const remote=uid=>({commit:r=>commit(uid,r),pull:()=>pull(uid)});
 const j1=createSyncedJournal(memory(),remote(a)),j2=createSyncedJournal(memory(),remote(a)),r=fresh();
 try{
  await t.test('offline save uploads, restores on another device, and hides from other accounts',async()=>{
   await j1.save(r);assert.equal(await j1.pending(),1);await j1.sync();assert.equal(await j1.pending(),0);await j2.sync();assert.equal((await j2.list())[0].vintage,'2021');
   assert.equal((await pull(b)).length,0);
   await as(null,()=>assert.rejects(db.query('select * from public.mg_entries'),e=>e.code==='42501'),'anon');
   await as(b,()=>assert.rejects(db.query('insert into public.mg_profiles(id) values($1)',[a]),e=>e.code==='42501'));
  });
  await t.test('public projection excludes private answers; revocation removes discussion',async()=>{
   await j1.publish(r.id,'public');await j1.sync();
   const pub=await as(null,async()=>(await db.query('select * from public.mg_public_entries')).rows,'anon');assert.equal(pub.length,1);assert.ok(!('conversation' in pub[0]));assert.equal(pub[0].wine_name,r.wineName);
   await as(b,async()=>{await db.query('insert into public.mg_profiles(id) values($1)',[b]);await db.query('insert into public.mg_comments(id,entry_id,author_id,body) values($1,$2,$3,$4)',[crypto.randomUUID(),r.id,b,'나도 향으로 돌아와 봤어요.']);await assert.rejects(db.query('update public.mg_public_entries set note=$1 where id=$2',['forged',r.id]),e=>e.code==='42501');});
   await j1.publish(r.id,'private');await j1.sync();assert.equal((await db.query('select * from public.mg_comments')).rows.length,0);assert.equal((await pull(a))[0].conversation[0].text,r.conversation[0].text);
  });
  await t.test('response loss retries the same mutation without a duplicate or extra revision',async()=>{
   let lose=true;const rr=fresh(),adapter=memory();
   const lostRemote={pull:()=>pull(a),commit:async x=>{const result=await commit(a,x);if(lose){lose=false;throw Error('response lost');}return result;}};
   const j=createSyncedJournal(adapter,lostRemote);await j.save(rr);await assert.rejects(j.sync(),/response lost/);assert.equal(await j.pending(),1);await j.sync();assert.equal((await j.list()).find(x=>x.id===rr.id).revision,1);assert.equal((await pull(a)).filter(x=>x.id===rr.id).length,1);
  });
  await t.test('conflicting edits are retained as a separate private copy',async()=>{
   await j2.sync();const before=(await j2.list()).find(x=>x.id===r.id);
   await j1.save({...before,note:'기기 1의 새 기록'});await j1.sync();await j2.save({...before,note:'기기 2에서 오프라인으로 쓴 기록'});const result=await j2.sync();assert.equal(result.conflicts,1);
   const rows=await j2.list();assert.equal(rows.find(x=>x.id===r.id).note,'기기 1의 새 기록');assert.ok(rows.some(x=>x.id!==r.id&&x.note==='기기 2에서 오프라인으로 쓴 기록'&&x.visibility==='private'));
  });
  await t.test('a server deletion cannot be resurrected by an older offline edit',async()=>{
   await j2.sync();const before=(await j2.list()).find(x=>x.id===r.id);await j1.remove(r.id);await j1.sync();await j2.save({...before,note:'삭제를 모르고 적은 내용'});await j2.sync();
   assert.ok(!(await j2.list()).some(x=>x.id===r.id));const tombstone=(await pull(a)).find(x=>x.id===r.id);assert.ok(tombstone.deleted);assert.equal(tombstone.note,'');assert.deepEqual(tombstone.conversation,[]);assert.ok((await j2.list()).some(x=>x.note==='삭제를 모르고 적은 내용'));
  });
  await t.test('account deletion cascades, blocks old JWT writes, and preserves another user',async()=>{
   await as(b,()=>assert.rejects(db.query('select public.mg_delete_account($1,$2)',['DELETE',a]),e=>e.code==='42501'));
   await as(a,()=>db.query('select public.mg_delete_account($1,$2)',['DELETE',a]));assert.equal((await db.query('select * from auth.users where id=$1',[a])).rows.length,0);assert.equal((await pull(a)).length,0);assert.equal((await db.query('select * from public.mg_profiles where id=$1',[b])).rows.length,1);
   await as(a,()=>assert.rejects(db.query('insert into public.mg_profiles(id) values($1)',[a]),e=>e.code==='23503'));
  });
 }finally{await db.close();}
});

test('editing while upload is in flight stays pending with the correct server revision',async()=>{
 let release;const gate=new Promise(r=>release=r);let first=true,server=null;
 const remote={commit:async r=>{if(first){first=false;await gate;}server={id:r.id,created_at:r.date,updated_at:r.date,note:r.note,context:r.context,wine_name:r.wineName,vintage:r.vintage,stage:r.stage,seconds:r.seconds,conversation:r.conversation,visibility:'private',deleted:false,revision:(server?.revision||0)+1,mutation_id:r.mutationId};return {status:'applied',entry:server};},pull:async()=>server?[server]:[]};
 const j=createSyncedJournal(memory(),remote),r=fresh();await j.save(r);const inflight=j.sync();await new Promise(r=>setTimeout(r,0));await j.save({...r,note:'저장 중에 더 적은 생각'});release();await inflight;assert.equal(await j.pending(),1);assert.equal((await j.list())[0].note,'저장 중에 더 적은 생각');await j.sync();assert.equal(await j.pending(),0);assert.equal(server.note,'저장 중에 더 적은 생각');
});
