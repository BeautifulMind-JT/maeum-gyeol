import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import { handleApi } from '../server/api.mjs';

function setup(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
 for(const name of readdirSync(new URL('../drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
 const DB={prepare(sql){let bindings=[];return{bind(...args){bindings=args;return this;},async first(){return sqlite.prepare(sql).get(...bindings)||null;},async all(){return{results:sqlite.prepare(sql).all(...bindings)};},async run(){const r=sqlite.prepare(sql).run(...bindings);return{success:true,meta:{changes:Number(r.changes)}};}};}};
 DB.batch=async statements=>{sqlite.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}};
 const req=async(path,{user,method='GET',body,origin='https://maeum-gyeol.justice-parkit.chatgpt.site'}={})=>{
  const headers={};if(user){headers['oai-authenticated-user-id']=user;headers['oai-authenticated-user-email']=user+'@example.invalid';}
  if(method!=='GET'){headers.origin=origin;headers['x-maeum-request']='1';headers['content-type']='application/json';}
  const response=await handleApi(new Request('https://maeum-gyeol.justice-parkit.chatgpt.site'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),{DB});
  return{status:response.status,headers:response.headers,data:await response.json()};
 };
 return{sqlite,DB,req};
}
const noteBody={note:'생각을 알아차리고 손에 닿는 감각으로 돌아왔다.',context:'와인 한 잔',scene:'wine',stage:'texture',seconds:150,conversation:[{role:'you',text:'이 대화는 비공개로 남아야 함'}],visibility:'public',ownerId:'client-must-not-control-owner'};

test('account export is private; confirmed deletion is atomic and preserves other accounts',async()=>{
 const {sqlite,req}=setup();try{
  const a=crypto.randomUUID(),b=crypto.randomUUID();
  const alice=await req('/api/entries/'+a,{user:'alice',method:'PUT',body:{...noteBody,wineName:'테스트 와인',vintage:'2021'}});
  const bob=await req('/api/entries/'+b,{user:'bob',method:'PUT',body:{...noteBody,note:'다른 사람의 기록'}});
  for(const [id,user] of [[a,'alice'],[b,'bob']])await req('/api/entries/'+id+'/visibility',{user,method:'PATCH',body:{visibility:'public'}});
  await req('/api/entries/'+b+'/comments',{user:'alice',method:'POST',body:{id:crypto.randomUUID(),body:'내가 남긴 댓글'}});
  await req('/api/entries/'+a+'/comments',{user:'bob',method:'POST',body:{id:crypto.randomUUID(),body:'내 기록에 달린 다른 사람 댓글'}});
  assert.equal((await req('/api/account/export')).status,401);
  const exported=(await req('/api/account/export',{user:'alice'})).data;
  assert.equal(exported.entries.length,1);assert.equal(exported.entries[0].wineName,'테스트 와인');
  assert.equal(exported.entries[0].conversation[0].text,noteBody.conversation[0].text);
  assert.equal(exported.comments.length,1);assert.equal(exported.comments[0].body,'내가 남긴 댓글');
  assert.ok(!JSON.stringify(exported).includes('example.invalid'));
  assert.equal((await req('/api/account',{method:'DELETE',body:{confirm:'DELETE'}})).status,401);
  assert.equal((await req('/api/account',{user:'alice',method:'DELETE',body:{}})).status,400);
  assert.equal((await req('/api/account',{user:'alice',method:'DELETE',origin:'https://elsewhere.invalid',body:{confirm:'DELETE'}})).status,403);
  sqlite.exec("CREATE TRIGGER deletion_failure BEFORE DELETE ON profiles BEGIN SELECT RAISE(ABORT,'test rollback'); END;");
  assert.equal((await req('/api/account',{user:'alice',method:'DELETE',body:{confirm:'DELETE'}})).status,503);
  assert.equal((await req('/api/account/export',{user:'alice'})).data.comments.length,1);
  assert.equal((await req('/api/entries/'+a,{user:'alice'})).status,200);
  sqlite.exec('DROP TRIGGER deletion_failure');
  assert.equal((await req('/api/account',{user:'alice',method:'DELETE',body:{confirm:'DELETE',ownerId:bob.data.entry.ownerId}})).status,200);
  assert.equal((await req('/api/me',{user:'alice'})).data.profile,null);
  assert.equal((await req('/api/entries/'+a)).status,404);
  assert.equal((await req('/api/entries/'+b,{user:'bob'})).status,200);
  assert.equal((await req('/api/profiles/'+alice.data.entry.ownerId)).status,404);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM comments').get().n,0);
  assert.equal((await req('/api/account',{user:'alice',method:'DELETE',body:{confirm:'DELETE'}})).status,200);
 }finally{sqlite.close();}
});

test('wine identity persists independently of the moment and follows sharing permissions',async()=>{
 const {sqlite,req}=setup();try{
  const id=crypto.randomUUID(),path='/api/entries/'+id;
  const details={...noteBody,scene:'daily',context:'퇴근 후 창가',wineName:'도멘 테스트 피노 누아',vintage:'2021'};
  const saved=await req(path,{user:'alice',method:'PUT',body:details});
  assert.equal(saved.status,200);assert.equal(saved.data.entry.scene,'wine');
  const check=e=>{assert.equal(e.wineName,details.wineName);assert.equal(e.vintage,'2021');assert.equal(e.context,details.context);};
  check(saved.data.entry);check((await req(path,{user:'alice'})).data.entry);
  check((await req('/api/entries',{user:'alice'})).data.items[0]);
  assert.equal((await req(path,{user:'bob'})).status,404);
  assert.equal((await req('/api/feed')).data.items.length,0);
  await req(path+'/visibility',{user:'alice',method:'PATCH',body:{visibility:'public'}});
  check((await req(path)).data.entry);check((await req('/api/feed')).data.items[0]);
  check((await req('/api/profiles/'+saved.data.entry.ownerId)).data.items[0]);
  assert.ok(!('conversation' in (await req(path)).data.entry));
  // A still-open older client must not erase newly recorded wine metadata.
  const olderClient={...noteBody,context:details.context};
  const updated=await req(path,{user:'alice',method:'PUT',body:olderClient});
  check(updated.data.entry);assert.equal(updated.data.entry.visibility,'private');
  for(const invalid of [{wineName:'x'.repeat(161)},{vintage:'21'},{vintage:'abcd'},{vintage:2021}]){
   assert.equal((await req(path,{user:'alice',method:'PUT',body:{...details,...invalid}})).status,400);
  }
  const nv=await req(path,{user:'alice',method:'PUT',body:{...details,vintage:'nv'}});assert.equal(nv.data.entry.vintage,'NV');
  const empty=await req(path,{user:'alice',method:'PUT',body:{...details,scene:'daily',wineName:'',vintage:''}});
  assert.equal(empty.status,200);assert.equal(empty.data.entry.wineName,'');assert.equal(empty.data.entry.vintage,'');assert.equal(empty.data.entry.scene,'daily');
 }finally{sqlite.close();}
});

test('adding wine fields preserves existing records without interpreting their context as wine',()=>{
 const sqlite=new DatabaseSync(':memory:');try{
  const migrations=readdirSync(new URL('../drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort();
  sqlite.exec(readFileSync(new URL('../drizzle/'+migrations[0],import.meta.url),'utf8'));
  sqlite.exec("INSERT INTO profiles(id,subject,created_at) VALUES ('owner','alice','2026-09-08'); INSERT INTO entries(id,owner_id,note,context,conversation,visibility,created_at,updated_at) VALUES ('old','owner','몸의 긴장을 알아차렸다.','잠깐 멈춘 시간','[]','private','2026-09-08','2026-09-08');");
  for(const name of migrations.slice(1))sqlite.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
  const row=sqlite.prepare('SELECT note,context,wine_name,vintage,visibility FROM entries WHERE id=?').get('old');
  assert.deepEqual({...row},{note:'몸의 긴장을 알아차렸다.',context:'잠깐 멈춘 시간',wine_name:'',vintage:'',visibility:'private'});
 }finally{sqlite.close();}
});

test('private records, ownership, public projections and revocation',async()=>{
 const {sqlite,req}=setup();try{
  const id=crypto.randomUUID();
  assert.equal((await req('/api/me')).data.authenticated,false);
  assert.equal((await req('/api/entries')).status,401);
  assert.equal((await req('/api/entries/'+id,{method:'PUT',body:noteBody})).status,401);
  let r=await req('/api/entries/'+id,{user:'alice',method:'PUT',body:noteBody});assert.equal(r.status,200);assert.equal(r.data.entry.visibility,'private');const profile=r.data.entry.ownerId;
  assert.notEqual(profile,noteBody.ownerId);
  assert.equal((await req('/api/entries/'+id)).status,404);
  assert.equal((await req('/api/entries/'+id,{user:'bob'})).status,404);
  assert.equal((await req('/api/feed')).data.items.length,0);
  assert.equal((await req('/api/profiles/'+profile)).data.items.length,0);
  assert.equal((await req('/api/entries/'+id,{user:'bob',method:'PUT',body:noteBody})).status,404);
  assert.equal((await req('/api/entries/'+id+'/visibility',{user:'bob',method:'PATCH',body:{visibility:'public'}})).status,404);
  assert.equal((await req('/api/entries/'+id,{user:'bob',method:'DELETE'})).status,404);
  assert.equal((await req('/api/entries/'+id,{user:'alice'})).data.entry.conversation[0].text,noteBody.conversation[0].text);
  assert.equal((await req('/api/entries/'+id+'/visibility',{user:'alice',method:'PATCH',body:{visibility:'public'}})).status,200);
  r=await req('/api/entries/'+id);assert.equal(r.status,200);assert.ok(!('conversation' in r.data.entry));assert.ok(!('subject' in r.data.entry));assert.ok(!JSON.stringify(r.data).includes('example.invalid'));
  const feed=await req('/api/feed');assert.equal(feed.data.items.length,1);assert.ok(!JSON.stringify(feed.data).includes(noteBody.conversation[0].text));assert.equal(feed.headers.get('cache-control'),'no-store');
  assert.equal((await req('/api/profiles/'+profile)).data.items.length,1);
  await req('/api/entries/'+id+'/visibility',{user:'alice',method:'PATCH',body:{visibility:'private'}});
  assert.equal((await req('/api/feed')).data.items.length,0);assert.equal((await req('/api/entries/'+id)).status,404);
  await req('/api/entries/'+id+'/visibility',{user:'alice',method:'PATCH',body:{visibility:'public'}});
  r=await req('/api/entries/'+id,{user:'alice',method:'PUT',body:noteBody});assert.equal(r.data.entry.visibility,'private');
 }finally{sqlite.close();}
});

test('comments: public-only writes, retries, access revocation and deletion permissions',async()=>{
 const {sqlite,req}=setup();try{
  const id=crypto.randomUUID(),comment=crypto.randomUUID();
  await req('/api/entries/'+id,{user:'alice',method:'PUT',body:noteBody});
  assert.equal((await req('/api/entries/'+id+'/comments',{user:'bob',method:'POST',body:{id:comment,body:'나도 이런 마음을 알아차렸어요.'}})).status,404);
  await req('/api/entries/'+id+'/visibility',{user:'alice',method:'PATCH',body:{visibility:'public'}});
  assert.equal((await req('/api/entries/'+id+'/comments',{method:'POST',body:{id:comment,body:'안녕'}})).status,401);
  assert.equal((await req('/api/entries/'+id+'/comments',{user:'bob',method:'POST',body:{id:comment,body:'나도 이런 마음을 알아차렸어요.'}})).status,201);
  assert.equal((await req('/api/entries/'+id+'/comments',{user:'bob',method:'POST',body:{id:comment,body:'나도 이런 마음을 알아차렸어요.'}})).status,200);
  let r=await req('/api/entries/'+id);assert.equal(r.data.comments.length,1);assert.equal(r.data.comments[0].canDelete,false);
  assert.equal((await req('/api/comments/'+comment,{user:'eve',method:'DELETE'})).status,404);
  await req('/api/entries/'+id+'/visibility',{user:'alice',method:'PATCH',body:{visibility:'private'}});
  assert.equal((await req('/api/entries/'+id,{user:'bob'})).status,404);
  assert.equal((await req('/api/entries/'+id+'/comments',{user:'bob',method:'POST',body:{id:crypto.randomUUID(),body:'새 댓글'}})).status,404);
  assert.equal((await req('/api/comments/'+comment,{user:'bob',method:'DELETE'})).status,200);
  await req('/api/entries/'+id+'/visibility',{user:'alice',method:'PATCH',body:{visibility:'public'}});
  const second=crypto.randomUUID();await req('/api/entries/'+id+'/comments',{user:'bob',method:'POST',body:{id:second,body:'소중한 이야기'}});assert.equal((await req('/api/comments/'+second,{user:'alice',method:'DELETE'})).status,200);
  const third=crypto.randomUUID();await req('/api/entries/'+id+'/comments',{user:'bob',method:'POST',body:{id:third,body:'고마워요'}});
  assert.equal((await req('/api/entries/'+id,{user:'alice',method:'DELETE'})).status,200);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM comments').get().n,0);
 }finally{sqlite.close();}
});

test('profile identity isolation, invalid payloads, cross-origin writes and storage errors',async()=>{
 const {sqlite,req}=setup();try{
  const id=crypto.randomUUID();
  assert.equal((await req('/api/profile',{user:'alice',method:'PUT',body:{name:'잠깐 머무는 나',bio:'일상을 알아차려요.'}})).status,200);
  const me=await req('/api/me',{user:'alice'});assert.equal(me.data.profile.name,'잠깐 머무는 나');assert.ok(!('subject' in me.data.profile));
  assert.equal((await req('/api/entries/'+id,{user:'alice',method:'PUT',body:noteBody,origin:'https://elsewhere.invalid'})).status,403);
  assert.equal((await req('/api/entries/'+id,{user:'alice',method:'PUT',body:{...noteBody,note:' '}})).status,400);
  assert.equal((await req('/api/entries/'+id,{user:'alice',method:'PUT',body:{...noteBody,note:'x'.repeat(1601)}})).status,400);
  assert.equal((await req('/api/entries/'+id,{user:'alice',method:'PUT',body:{...noteBody,note:'x'.repeat(25000)}})).status,413);
  assert.equal((await req('/api/feed?offset=-1')).status,400);
  const response=await handleApi(new Request('https://maeum-gyeol.justice-parkit.chatgpt.site/api/feed'),{});
  assert.equal(response.status,503);
 }finally{sqlite.close();}
});
