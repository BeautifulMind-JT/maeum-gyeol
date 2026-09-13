-- Run against the dedicated project with the Supabase SQL tool.
-- All synthetic identities and records are rolled back; no email is sent.
begin;
select set_config('maeum.verify_owner',gen_random_uuid()::text,true),
       set_config('maeum.verify_other',gen_random_uuid()::text,true),
       set_config('maeum.verify_entry',gen_random_uuid()::text,true),
       set_config('maeum.verify_mutation',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email)
select current_setting('maeum.verify_owner')::uuid,'authenticated','authenticated','maeum-verify-'||current_setting('maeum.verify_owner')||'@example.invalid'
union all
select current_setting('maeum.verify_other')::uuid,'authenticated','authenticated','maeum-verify-'||current_setting('maeum.verify_other')||'@example.invalid';

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('maeum.verify_owner'),true);
do $$
declare result jsonb;
begin
 result:=public.mg_commit_entry(current_setting('maeum.verify_entry')::uuid,0,current_setting('maeum.verify_mutation')::uuid,
   '{"note":"검증용 알아차림","wineName":"Poliziano","vintage":"2021","conversation":[{"role":"you","text":"비공개 답변"}]}');
 assert result->>'status'='applied','owner save failed';
 assert result->'entry'->>'visibility'='private','new entry must be private';
 result:=public.mg_commit_entry(current_setting('maeum.verify_entry')::uuid,0,current_setting('maeum.verify_mutation')::uuid,'{"note":"retry"}');
 assert (result->'entry'->>'revision')::int=1,'retry changed revision';
 result:=public.mg_commit_entry(current_setting('maeum.verify_entry')::uuid,0,gen_random_uuid(),'{"note":"stale edit"}');
 assert result->>'status'='conflict','stale edit was accepted';
 result:=public.mg_commit_entry(current_setting('maeum.verify_entry')::uuid,1,gen_random_uuid(),
   '{"note":"공개 기록","wineName":"Poliziano","vintage":"2021","visibility":"public","conversation":[{"role":"you","text":"비공개 답변"}]}');
 assert result->>'status'='applied','publish failed';
end $$;

select set_config('request.jwt.claim.sub',current_setting('maeum.verify_other'),true);
do $$
begin
 assert not exists(select from public.mg_entries where id=current_setting('maeum.verify_entry')::uuid),'other user read private original';
 insert into public.mg_profiles(id) values(current_setting('maeum.verify_other')::uuid);
 insert into public.mg_comments(id,entry_id,author_id,body)
 values(gen_random_uuid(),current_setting('maeum.verify_entry')::uuid,current_setting('maeum.verify_other')::uuid,'검증용 댓글');
 begin
  update public.mg_public_entries set note='forged' where id=current_setting('maeum.verify_entry')::uuid;
  raise exception 'Direct publication write was allowed';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.mg_delete_account('DELETE',current_setting('maeum.verify_owner')::uuid);
  raise exception 'Account-switch deletion was allowed';
 exception when insufficient_privilege then null;
 end;
end $$;

set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$
declare published jsonb;
begin
 select to_jsonb(e) into published from public.mg_public_entries e where id=current_setting('maeum.verify_entry')::uuid;
 assert published->>'wine_name'='Poliziano','public wine record missing';
 assert not(published?'conversation'),'private answers leaked';
 assert (select count(*)=1 from public.mg_comments where entry_id=current_setting('maeum.verify_entry')::uuid),'public comment missing';
 begin
  perform id from public.mg_entries limit 1;
  raise exception 'Anonymous private read was allowed';
 exception when insufficient_privilege then null;
 end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('maeum.verify_owner'),true);
do $$
declare result jsonb;
begin
 result:=public.mg_commit_entry(current_setting('maeum.verify_entry')::uuid,2,gen_random_uuid(),
   '{"note":"다시 비공개","visibility":"private","conversation":[{"role":"you","text":"비공개 답변"}]}');
 assert result->>'status'='applied','unpublish failed';
 assert not exists(select from public.mg_public_entries where id=current_setting('maeum.verify_entry')::uuid),'public copy remains';
 assert not exists(select from public.mg_comments where entry_id=current_setting('maeum.verify_entry')::uuid),'revoked comments remain';
 result:=public.mg_commit_entry(current_setting('maeum.verify_entry')::uuid,3,gen_random_uuid(),'{"note":"","deleted":true}');
 assert (result->'entry'->>'deleted')::boolean,'tombstone missing';
 assert result->'entry'->'conversation'='[]'::jsonb,'deleted answers remain';
 result:=public.mg_commit_entry(current_setting('maeum.verify_entry')::uuid,3,gen_random_uuid(),'{"note":"old offline edit"}');
 assert result->>'status'='conflict','deleted record resurrected';
 perform public.mg_delete_account('DELETE',current_setting('maeum.verify_owner')::uuid);
 assert not exists(select from public.mg_entries where id=current_setting('maeum.verify_entry')::uuid),'account records remain';
 begin
  insert into public.mg_profiles(id) values(current_setting('maeum.verify_owner')::uuid);
  raise exception 'Deleted identity recreated profile';
 exception when foreign_key_violation then null;
 end;
end $$;
reset role;
do $$
begin
 assert exists(select from auth.users where id=current_setting('maeum.verify_other')::uuid),'other account deleted';
 assert not exists(select from auth.users where id=current_setting('maeum.verify_owner')::uuid),'owner identity remains';
end $$;
rollback;
select 'PASS: owner privacy, public projection, comments, retry, conflict, tombstone, account deletion; all fixtures rolled back' as verification;
