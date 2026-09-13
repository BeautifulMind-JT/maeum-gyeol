-- Server-only journals: one private, revision-checked draft per account.
create table public.mg_drafts (
 owner_id uuid primary key references public.mg_profiles(id) on delete cascade,
 revision bigint not null check(revision>0),
 mutation_id uuid not null,
 payload jsonb,
 updated_at timestamptz not null default now(),
 check(payload is null or (jsonb_typeof(payload)='object' and octet_length(payload::text)<=64000))
);
alter table public.mg_drafts enable row level security;
revoke all on public.mg_drafts from public,anon,authenticated;
grant select on public.mg_drafts to authenticated;
create policy drafts_owner_read on public.mg_drafts for select to authenticated
 using(owner_id=(select auth.uid()));

create function maeum_internal.commit_draft(p_base_revision bigint,p_mutation_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();current_row public.mg_drafts;next_payload jsonb;photo text;field text;item jsonb;
begin
 if who is null or not exists(select 1 from auth.users where id=who) then raise exception 'Sign in required' using errcode='42501';end if;
 if p_base_revision is null or p_base_revision<0 or p_mutation_id is null then raise exception 'Invalid mutation';end if;
 perform pg_advisory_xact_lock(hashtextextended(who::text,0));
 insert into public.mg_profiles(id) values(who) on conflict do nothing;
 select * into current_row from public.mg_drafts where owner_id=who for update;
 if found and current_row.mutation_id=p_mutation_id then return jsonb_build_object('status','applied','draft',to_jsonb(current_row));end if;
 if coalesce(current_row.revision,0)<>p_base_revision then return jsonb_build_object('status','conflict','draft',to_jsonb(current_row));end if;
 if p_payload is not null then
  if jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>64000
   or coalesce(p_payload->>'id','')!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
   or nullif(p_payload->>'date','') is null then raise exception 'Invalid draft';end if;
  perform (p_payload->>'date')::timestamptz;
  foreach field in array array['note','context','wineName','vintage'] loop
   if p_payload ? field and jsonb_typeof(p_payload->field)<>'string' then raise exception 'Invalid draft text';end if;
  end loop;
  if char_length(coalesce(p_payload->>'note',''))>1600 or char_length(coalesce(p_payload->>'context',''))>160
   or char_length(coalesce(p_payload->>'wineName',''))>160 or char_length(coalesce(p_payload->>'vintage',''))>4 then raise exception 'Draft text too long';end if;
  if coalesce(p_payload->>'stage','finish') not in ('color','aroma','texture','finish') then raise exception 'Invalid stage';end if;
  if coalesce((p_payload->>'seconds')::integer,0) not between 0 and 86400 then raise exception 'Invalid duration';end if;
  if jsonb_typeof(coalesce(p_payload->'conversation','[]'))<>'array' or jsonb_array_length(coalesce(p_payload->'conversation','[]'))>8 then raise exception 'Invalid reflection';end if;
  for item in select value from jsonb_array_elements(coalesce(p_payload->'conversation','[]')) loop
   if jsonb_typeof(item)<>'object' or coalesce(item->>'role','') not in ('you','guide')
    or coalesce(jsonb_typeof(item->'text'),'null')<>'string' or char_length(item->>'text')>1600 then raise exception 'Invalid reflection';end if;
  end loop;
  photo:=nullif(p_payload->>'photoPath','');
  if photo is not null then
   if split_part(photo,'/',1)<>who::text or photo!~'^[0-9a-f-]{36}/[0-9a-f-]{36}$' then raise exception 'Photo owner required' using errcode='42501';end if;
   if not exists(select 1 from storage.objects where bucket_id='maeum-photos' and name=photo||'-full.jpg')
    or not exists(select 1 from storage.objects where bucket_id='maeum-photos' and name=photo||'-thumb.jpg') then raise exception '사진 업로드를 마친 뒤 저장해주세요.';end if;
  end if;
  next_payload:=jsonb_build_object('id',p_payload->>'id','date',p_payload->>'date',
   'note',coalesce(p_payload->>'note',''),'context',coalesce(p_payload->>'context',''),'wineName',coalesce(p_payload->>'wineName',''),
   'vintage',coalesce(p_payload->>'vintage',''),'stage',coalesce(p_payload->>'stage','finish'),'seconds',coalesce((p_payload->>'seconds')::int,0),
   'conversation',coalesce(p_payload->'conversation','[]'),'photoPath',photo,'commentsEnabled',coalesce((p_payload->>'commentsEnabled')::boolean,true),
   'featured',coalesce((p_payload->>'featured')::boolean,false),'entryRevision',greatest(coalesce((p_payload->>'entryRevision')::bigint,0),0),
   'visibility',case when p_payload->>'visibility'='public' then 'public' else 'private' end);
 end if;
 if current_row.payload->>'photoPath' is not null and current_row.payload->>'photoPath' is distinct from next_payload->>'photoPath' then
  insert into public.mg_media_gc(photo_path,owner_id) values(current_row.payload->>'photoPath',who) on conflict do nothing;
 end if;
 insert into public.mg_drafts(owner_id,revision,mutation_id,payload) values(who,1,p_mutation_id,next_payload)
 on conflict(owner_id) do update set revision=mg_drafts.revision+1,mutation_id=excluded.mutation_id,payload=excluded.payload,updated_at=clock_timestamp()
 returning * into current_row;
 return jsonb_build_object('status','applied','draft',to_jsonb(current_row));
end $$;
revoke all on function maeum_internal.commit_draft(bigint,uuid,jsonb) from public,anon;
grant execute on function maeum_internal.commit_draft(bigint,uuid,jsonb) to authenticated;
create function public.mg_commit_draft(p_base_revision bigint,p_mutation_id uuid,p_payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select maeum_internal.commit_draft(p_base_revision,p_mutation_id,p_payload);
$$;
revoke all on function public.mg_commit_draft(bigint,uuid,jsonb) from public,anon;
grant execute on function public.mg_commit_draft(bigint,uuid,jsonb) to authenticated;

-- Commit the entry and retire exactly the draft the caller edited in one transaction.
-- An acknowledgement lost in transit can be retried without resurrecting that draft.
create function maeum_internal.save_entry(p_id uuid,p_base_revision bigint,p_mutation_id uuid,p_payload jsonb,p_draft_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();current_draft public.mg_drafts;current_entry public.mg_entries;result jsonb;
begin
 if who is null or not exists(select 1 from auth.users where id=who) then raise exception 'Sign in required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(who::text,0));
 select * into current_entry from public.mg_entries where owner_id=who and id=p_id;
 select * into current_draft from public.mg_drafts where owner_id=who for update;
 if current_entry.mutation_id=p_mutation_id then return jsonb_build_object('status','applied','entry',to_jsonb(current_entry),'draft',to_jsonb(current_draft));end if;
 if p_draft_revision is not null and (current_draft.revision is distinct from p_draft_revision or current_draft.payload->>'id' is distinct from p_id::text) then
  return jsonb_build_object('status','draft_conflict','draft',to_jsonb(current_draft));
 end if;
 result:=maeum_internal.mg_commit_entry(p_id,p_base_revision,p_mutation_id,p_payload);
 if result->>'status'='applied' and p_draft_revision is not null then
  perform maeum_internal.commit_draft(p_draft_revision,gen_random_uuid(),null);
  select * into current_draft from public.mg_drafts where owner_id=who;
 end if;
 return result||jsonb_build_object('draft',to_jsonb(current_draft));
end $$;
revoke all on function maeum_internal.save_entry(uuid,bigint,uuid,jsonb,bigint) from public,anon;
grant execute on function maeum_internal.save_entry(uuid,bigint,uuid,jsonb,bigint) to authenticated;
create function public.mg_save_entry(p_id uuid,p_base_revision bigint,p_mutation_id uuid,p_payload jsonb,p_draft_revision bigint default null)
returns jsonb language sql security invoker set search_path='' as $$
 select maeum_internal.save_entry(p_id,p_base_revision,p_mutation_id,p_payload,p_draft_revision);
$$;
revoke all on function public.mg_save_entry(uuid,bigint,uuid,jsonb,bigint) from public,anon;
grant execute on function public.mg_save_entry(uuid,bigint,uuid,jsonb,bigint) to authenticated;
