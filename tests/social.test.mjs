import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './db-fixture.mjs';

test('social archive enforces ownership, publication, blocks and write limits',async t=>{
 const {db,as,user,commit}=await database();const a=await user(),b=await user(),c=await user();let entry,photo=a+'/'+crypto.randomUUID();
 try{
  await t.test('private photo is owner-only and cannot be attached across accounts',async()=>{
   await as(a,()=>db.query("insert into storage.objects(bucket_id,name) values('maeum-photos',$1),('maeum-photos',$2)",[photo+'-full.jpg',photo+'-thumb.jpg']));
   assert.equal((await as(b,()=>db.query('select * from storage.objects'))).rows.length,0);
   assert.equal((await as(null,()=>db.query('select * from storage.objects'))).rows.length,0);
   await assert.rejects(commit(b,{photoPath:photo}),e=>e.code==='23514');
   entry=(await commit(a,{photoPath:photo,conversation:[{role:'you',text:'내 사적인 답변'}]})).entry;
  });
  await t.test('only the revision-checked write path can modify a journal',async()=>{
   await as(a,()=>assert.rejects(db.query("update public.mg_entries set note='stale' where id=$1",[entry.id]),e=>e.code==='42501'));
   await as(a,()=>assert.rejects(db.query('insert into public.mg_entries(id) values($1)',[crypto.randomUUID()]),e=>e.code==='42501'));
   const conflict=await commit(a,{note:'older'},0,entry.id);assert.equal(conflict.status,'conflict');
   assert.equal((await as(b,()=>db.query('select * from public.mg_entries'))).rows.length,0);
  });
  await t.test('publication reveals only selected content and currently attached photos',async()=>{
   entry=(await commit(a,{visibility:'public',photoPath:photo,featured:true,conversation:[{role:'you',text:'내 사적인 답변'}]},entry.revision,entry.id)).entry;
   const rows=(await as(null,()=>db.query('select * from public.mg_public_entries'))).rows;assert.equal(rows.length,1);assert.ok(!('conversation' in rows[0]));assert.equal(rows[0].photo_path,photo);
   assert.equal((await as(null,()=>db.query('select * from storage.objects'))).rows.length,2);
  });
  await t.test('follow feed and reactions are unique and notify the recipient only',async()=>{
   await as(b,()=>db.query('insert into public.mg_follows(follower_id,following_id) values($1,$2)',[b,a]));
   assert.equal((await as(b,()=>db.query('select * from public.mg_feed(true)'))).rows.length,1);
   assert.equal((await as(c,()=>db.query('select * from public.mg_feed(true)'))).rows.length,0);
   await as(b,()=>db.query('insert into public.mg_likes(user_id,entry_id) values($1,$2) on conflict do nothing',[b,entry.id]));
   await as(b,()=>db.query('insert into public.mg_likes(user_id,entry_id) values($1,$2) on conflict do nothing',[b,entry.id]));
   assert.equal((await db.query('select * from public.mg_likes')).rows.length,1);
   assert.equal((await as(a,()=>db.query('select * from public.mg_notifications'))).rows.length,2);
   assert.equal((await as(b,()=>db.query('select * from public.mg_notifications'))).rows.length,0);
  });
  await t.test('comment control is enforced by the database',async()=>{
   entry=(await commit(a,{visibility:'public',commentsEnabled:false},entry.revision,entry.id)).entry;
   await as(b,()=>assert.rejects(db.query('insert into public.mg_comments(id,entry_id,author_id,body) values($1,$2,$3,$4)',[crypto.randomUUID(),entry.id,b,'hello']),e=>e.code==='42501'));
   assert.equal(entry.photo_path,photo,'older clients which omit photo fields preserve them');
   entry=(await commit(a,{visibility:'public',commentsEnabled:true},entry.revision,entry.id)).entry;
  });
  await t.test('blocking removes follows, rejects reactions, and filters signed-in views',async()=>{
   await as(a,()=>db.query('insert into public.mg_blocks(blocker_id,blocked_id) values($1,$2)',[a,b]));
   assert.equal((await db.query('select * from public.mg_follows')).rows.length,0);
   assert.equal((await as(b,()=>db.query('select * from public.mg_public_entries'))).rows.length,0);
   await as(b,()=>assert.rejects(db.query('insert into public.mg_comments(id,entry_id,author_id,body) values($1,$2,$3,$4)',[crypto.randomUUID(),entry.id,b,'blocked']),e=>e.code==='42501'));
   await as(b,()=>assert.rejects(db.query('insert into public.mg_follows(follower_id,following_id) values($1,$2)',[b,a]),e=>e.code==='42501'));
  });
  await t.test('reports are private; rate counters survive comment deletion',async()=>{
   await as(c,()=>db.query("insert into public.mg_reports(reporter_id,entry_id,reason) values($1,$2,'spam')",[c,entry.id]));
   assert.equal((await as(a,()=>db.query('select * from public.mg_reports'))).rows.length,0);
   for(let i=0;i<10;i++){const id=crypto.randomUUID();await as(c,()=>db.query('insert into public.mg_comments(id,entry_id,author_id,body) values($1,$2,$3,$4)',[id,entry.id,c,'test']));await as(c,()=>db.query('delete from public.mg_comments where id=$1',[id]));}
   await as(c,()=>assert.rejects(db.query('insert into public.mg_comments(id,entry_id,author_id,body) values($1,$2,$3,$4)',[crypto.randomUUID(),entry.id,c,'too many']),/잠시/));
  });
  await t.test('withdrawing a post immediately revokes image and reaction access',async()=>{
   entry=(await commit(a,{visibility:'private'},entry.revision,entry.id)).entry;
   assert.equal((await as(null,()=>db.query('select * from storage.objects'))).rows.length,0);
   assert.equal((await db.query('select * from public.mg_likes')).rows.length,0);
   assert.equal((await db.query("select * from public.mg_notifications where entry_id=$1",[entry.id])).rows.length,0);
   entry=(await commit(a,{deleted:true},entry.revision,entry.id)).entry;assert.equal(entry.photo_path,null);assert.equal(entry.note,'');
   assert.equal((await as(a,()=>db.query('select * from public.mg_media_gc'))).rows[0].photo_path,photo);
  });
  await t.test('deleting an account cannot leave storage objects behind',async()=>{
   await as(a,()=>assert.rejects(db.query("select public.mg_delete_account('DELETE',$1)",[a]),/写真|사진/));
   await as(a,()=>db.query('delete from storage.objects where name like $1',[a+'/%']));
   await as(a,()=>db.query("select public.mg_delete_account('DELETE',$1)",[a]));
   await assert.rejects(commit(a,{}),e=>e.code==='23503');
  });
 }finally{await db.close();}
});
