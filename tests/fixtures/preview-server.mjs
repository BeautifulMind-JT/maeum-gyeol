import {database} from '../db-fixture.mjs';
const me='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
export async function previewDatabase(){
 const {db,as,user,commit}=await database();await user(me);await user(other);
 await db.query('update public.mg_profiles set name=$1,bio=$2 where id=$3',['머무는 사람','오늘의 감각을 천천히 모아요',me]);
 await db.query('update public.mg_profiles set name=$1,bio=$2 where id=$3',['수연','평가보다 알아차림',other]);
 const one=(await commit(me,{date:'2026-09-11T09:00:00Z',context:'생각이 잠깐 멈춘 저녁',wineName:'Poliziano · Rosso di Montepulciano',vintage:'2023',note:'잔을 쥔 손에 서늘한 온기가 남았다. 향을 맞히려던 마음을 잠시 내려놓고, 지금 느껴지는 것에 머물렀다.\n\n자꾸 내일의 일이 떠올랐다. 그때마다 잔의 온도로 돌아왔다. 생각이 사라지지 않아도 괜찮았다.',visibility:'public',seconds:180,stage:'finish'})).entry;
 await commit(me,{date:'2026-09-05T09:00:00Z',context:'조금 더 느리게, 오늘',note:'창밖을 바라보다가 들숨과 날숨의 온도가 다르다는 걸 알았다.',seconds:180,stage:'texture',visibility:'private'});
 const two=(await commit(other,{date:'2026-09-13T08:00:00Z',context:'비 그친 오후',note:'창을 열고 젖은 흙 냄새를 맡았다. 이름을 붙이지 않고, 그 냄새에만 머물렀다.',visibility:'public',seconds:180,stage:'aroma'})).entry;
 await commit(other,{note:two.note,context:two.context,stage:two.stage,seconds:two.seconds,visibility:'public'},two.revision,two.id);
 await commit(me,{note:one.note,context:one.context,wineName:one.wine_name,vintage:one.vintage,stage:one.stage,seconds:one.seconds,visibility:'public'},one.revision,one.id);
 await as(other,()=>db.query('insert into public.mg_comments(id,entry_id,author_id,body) values($1,$2,$3,$4)',[crypto.randomUUID(),one.id,other,'저도 오늘은 온도에 집중해봤어요.']));
 let serial=Promise.resolve(),fault=null;
 const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
 async function invoke(action,a,uid){
  if(action==='control'){fault=a.fault;return {ok:true};}
  if(action==='commitDraft'&&fault==='draft'){fault=null;throw Object.assign(Error('미리보기: 연결 끊김'),{status:503});}
  if(action==='save'&&fault==='save'){fault=null;throw Object.assign(Error('미리보기: 연결 끊김'),{status:503});}
  const result=await as(uid,async()=>{
   if(action==='pull')return q('select * from public.mg_entries order by created_at desc');
   if(action==='loadDraft')return (await q('select * from public.mg_drafts'))[0]||null;
   if(action==='commitDraft')return (await q('select public.mg_commit_draft($1,$2,$3) r',[a.r.revision,a.r.mutationId,a.r.payload===null?null:JSON.stringify(a.r.payload)]))[0].r;
   if(action==='commit')return (await q('select public.mg_commit_entry($1,$2,$3,$4) r',[a.r.id,a.r.revision,a.r.mutationId,JSON.stringify(a.r)]))[0].r;
   if(action==='save')return (await q('select public.mg_save_entry($1,$2,$3,$4,$5) r',[a.r.id,a.r.revision,a.r.mutationId,JSON.stringify(a.r),a.rev]))[0].r;
   if(action==='feed'||action==='entry'||action==='featured'){let rows=await q('select e.*,json_build_object(\'name\',p.name) author from public.mg_public_entries e join public.mg_profiles p on p.id=e.owner_id order by e.created_at desc');if(a.id)rows=rows.filter(r=>action==='entry'?r.id===a.id:r.owner_id===a.id);return action==='entry'?rows[0]:action==='featured'?rows.filter(r=>r.featured):rows;}
   if(action==='comments')return q('select c.*,json_build_object(\'name\',p.name) author from public.mg_comments c join public.mg_profiles p on p.id=c.author_id where entry_id=$1 order by created_at',[a.id]);
   if(action==='reactions'){const rows=await q('select user_id from public.mg_likes where entry_id=$1',[a.id]);return {likes:rows.length,liked:rows.some(r=>r.user_id===uid)};}
   if(action==='like'){if(a.value)await q('insert into public.mg_likes(user_id,entry_id) values($1,$2) on conflict do nothing',[uid,a.id]);else await q('delete from public.mg_likes where user_id=$1 and entry_id=$2',[uid,a.id]);return {};}
   if(action==='comment'){await q('insert into public.mg_comments(id,entry_id,author_id,body) values($1,$2,$3,$4) on conflict do nothing',[a.commentId,a.id,uid,a.body]);return {};}
   if(action==='profile')return (await q('select id,name,bio from public.mg_profiles where id=$1',[a.id||uid]))[0];
   if(action==='saveProfile'){await q('update public.mg_profiles set name=$1,bio=$2 where id=$3',[a.name,a.bio,uid]);return {};}
   if(action==='counts')return {entries:(await q('select id from public.mg_public_entries where owner_id=$1',[a.id])).length,followers:0,following:0};
   if(action==='people')return q('select id,name,bio from public.mg_profiles where name ilike $1',['%'+(a.query||'')+'%']);
   throw Error('Unknown preview action');
  });
  if(action==='save'&&fault==='lost'){fault=null;throw Object.assign(Error('미리보기: 저장 후 응답 유실'),{status:503});}
  return result;
 }
 return (action,args,uid)=>{const p=serial.then(()=>invoke(action,args,uid===me?me:null));serial=p.catch(()=>{});return p;};
}
