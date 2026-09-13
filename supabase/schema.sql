-- Fresh-project schema: applied in this order by the versioned migrations.
-- Private journals and deliberately published projections are separate tables.
-- Apply only to the dedicated 마음결 project. Keep the existing D1 archive intact.
create schema if not exists maeum_internal;
revoke all on schema maeum_internal from public, anon, authenticated;

create table public.mg_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null default '머무는 사람' check (char_length(name) between 1 and 32),
 bio text not null default '' check (char_length(bio) <= 240),
 created_at timestamptz not null default now()
);
create table public.mg_entries (
 id uuid primary key,
 owner_id uuid not null references public.mg_profiles(id) on delete cascade,
 note text not null check (char_length(note) <= 1600),
 context text not null default '' check (char_length(context) <= 160),
 wine_name text not null default '' check (char_length(wine_name) <= 160),
 vintage text not null default '' check (vintage = '' or vintage ~ '^(\d{4}|NV)$'),
 stage text not null default 'finish' check (stage in ('color','aroma','texture','finish')),
 seconds integer not null default 0 check (seconds between 0 and 86400),
 conversation jsonb not null default '[]' check (jsonb_typeof(conversation)='array' and jsonb_array_length(conversation)<=8 and octet_length(conversation::text)<=56000),
 visibility text not null default 'private' check (visibility in ('private','public')),
 deleted boolean not null default false,
 revision bigint not null default 1 check (revision > 0),
 mutation_id uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (deleted or char_length(btrim(note)) > 0)
);
create index mg_entries_owner_updated on public.mg_entries(owner_id, updated_at, id);
create table public.mg_public_entries (
 id uuid primary key references public.mg_entries(id) on delete cascade,
 owner_id uuid not null references public.mg_profiles(id) on delete cascade,
 note text not null,
 context text not null,
 wine_name text not null,
 vintage text not null,
 stage text not null,
 created_at timestamptz not null,
 updated_at timestamptz not null
);
create index mg_public_entries_created on public.mg_public_entries(created_at desc, id);
create index mg_public_entries_owner on public.mg_public_entries(owner_id);
create table public.mg_comments (
 id uuid primary key,
 entry_id uuid not null references public.mg_public_entries(id) on delete cascade,
 author_id uuid not null references public.mg_profiles(id) on delete cascade,
 body text not null check (char_length(btrim(body)) between 1 and 1000),
 created_at timestamptz not null default now()
);
create index mg_comments_entry_created on public.mg_comments(entry_id,created_at,id);
create index mg_comments_author on public.mg_comments(author_id);

alter table public.mg_profiles enable row level security;
alter table public.mg_entries enable row level security;
alter table public.mg_public_entries enable row level security;
alter table public.mg_comments enable row level security;
revoke all on public.mg_profiles, public.mg_entries, public.mg_public_entries, public.mg_comments from public, anon, authenticated;
grant select on public.mg_profiles, public.mg_public_entries, public.mg_comments to anon, authenticated;
grant select, insert, update on public.mg_entries to authenticated;
grant insert, update on public.mg_profiles to authenticated;
grant insert, delete on public.mg_comments to authenticated;
create policy profiles_read on public.mg_profiles for select to anon, authenticated using (true);
create policy profiles_insert on public.mg_profiles for insert to authenticated with check (id=(select auth.uid()));
create policy profiles_update on public.mg_profiles for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));
create policy entries_read on public.mg_entries for select to authenticated using (owner_id=(select auth.uid()));
create policy entries_insert on public.mg_entries for insert to authenticated with check (owner_id=(select auth.uid()));
create policy entries_update on public.mg_entries for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy public_entries_read on public.mg_public_entries for select to anon, authenticated using (true);
create policy comments_read on public.mg_comments for select to anon, authenticated using (exists(select 1 from public.mg_public_entries e where e.id=entry_id));
create policy comments_insert on public.mg_comments for insert to authenticated with check (author_id=(select auth.uid()) and exists(select 1 from public.mg_public_entries e where e.id=entry_id));
create policy comments_delete on public.mg_comments for delete to authenticated using (author_id=(select auth.uid()) or exists(select 1 from public.mg_public_entries e where e.id=entry_id and e.owner_id=(select auth.uid())));

create function maeum_internal.prepare_entry() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.id<>old.id or new.owner_id<>old.owner_id then raise exception 'Entry identity is immutable' using errcode='42501'; end if;
  if old.deleted and not new.deleted then raise exception 'Deleted entries cannot be restored in place' using errcode='23514'; end if;
  new.created_at:=old.created_at;
  new.revision:=old.revision+1;
 else new.revision:=1;
 end if;
 new.updated_at:=clock_timestamp();
 if new.deleted then
  new.note:='';new.context:='';new.wine_name:='';new.vintage:='';new.conversation:='[]';new.seconds:=0;new.visibility:='private';
 end if;
 return new;
end $$;
revoke all on function maeum_internal.prepare_entry() from public, anon, authenticated;
create trigger prepare_entry before insert or update on public.mg_entries for each row execute function maeum_internal.prepare_entry();

-- A trigger is the only writer of public projections. Definer rights are needed
-- because API users deliberately have no write grants on mg_public_entries.
-- The function is outside exposed schemas, has no callable API, and checks uid.
create function maeum_internal.project_entry() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid()<>new.owner_id then raise exception 'Owner required' using errcode='42501'; end if;
 if new.visibility='public' and not new.deleted then
  insert into public.mg_public_entries(id,owner_id,note,context,wine_name,vintage,stage,created_at,updated_at)
  values(new.id,new.owner_id,new.note,new.context,new.wine_name,new.vintage,new.stage,new.created_at,new.updated_at)
  on conflict(id) do update set note=excluded.note,context=excluded.context,wine_name=excluded.wine_name,vintage=excluded.vintage,stage=excluded.stage,updated_at=excluded.updated_at;
 else delete from public.mg_public_entries where id=new.id;
 end if;
 return new;
end $$;
revoke all on function maeum_internal.project_entry() from public, anon, authenticated;
create trigger project_entry after insert or update on public.mg_entries for each row execute function maeum_internal.project_entry();

create function public.mg_commit_entry(p_id uuid,p_base_revision bigint,p_mutation_id uuid,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_row public.mg_entries; result_row public.mg_entries; who uuid:=auth.uid();
begin
 if who is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_base_revision is null or p_base_revision<0 or p_mutation_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid mutation'; end if;
 insert into public.mg_profiles(id) values(who) on conflict(id) do nothing;
 select * into current_row from public.mg_entries where id=p_id and owner_id=who for update;
 if found then
  if current_row.mutation_id=p_mutation_id then return jsonb_build_object('status','applied','entry',to_jsonb(current_row)); end if;
  if current_row.revision<>p_base_revision or current_row.deleted then return jsonb_build_object('status','conflict','entry',to_jsonb(current_row)); end if;
  update public.mg_entries set note=p_payload->>'note',context=coalesce(p_payload->>'context',''),wine_name=coalesce(p_payload->>'wineName',''),vintage=coalesce(p_payload->>'vintage',''),stage=coalesce(p_payload->>'stage','finish'),seconds=coalesce((p_payload->>'seconds')::int,0),conversation=coalesce(p_payload->'conversation','[]'),visibility=coalesce(p_payload->>'visibility','private'),deleted=coalesce((p_payload->>'deleted')::boolean,false),mutation_id=p_mutation_id
  where id=p_id and owner_id=who returning * into result_row;
 else
  if p_base_revision<>0 then return jsonb_build_object('status','missing','entry',null); end if;
  insert into public.mg_entries(id,owner_id,note,context,wine_name,vintage,stage,seconds,conversation,visibility,deleted,mutation_id,created_at)
  values(p_id,who,p_payload->>'note',coalesce(p_payload->>'context',''),coalesce(p_payload->>'wineName',''),coalesce(p_payload->>'vintage',''),coalesce(p_payload->>'stage','finish'),coalesce((p_payload->>'seconds')::int,0),coalesce(p_payload->'conversation','[]'),'private',coalesce((p_payload->>'deleted')::boolean,false),p_mutation_id,coalesce((p_payload->>'date')::timestamptz,now()))
  returning * into result_row;
 end if;
 return jsonb_build_object('status','applied','entry',to_jsonb(result_row));
end $$;
revoke all on function public.mg_commit_entry(uuid,bigint,uuid,jsonb) from public, anon;
grant execute on function public.mg_commit_entry(uuid,bigint,uuid,jsonb) to authenticated;

-- Delete Auth identity too. Existing JWTs cannot recreate records because the
-- profile FK must still reference a live auth.users row. No service key in app.
create function maeum_internal.delete_account() returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();
begin
 if who is null then raise exception 'Sign in required' using errcode='42501'; end if;
 delete from auth.users where id=who;
end $$;
revoke all on function maeum_internal.delete_account() from public, anon, authenticated;
grant usage on schema maeum_internal to authenticated;
grant execute on function maeum_internal.delete_account() to authenticated;
create function public.mg_delete_account(p_confirm text,p_expected_uid uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_confirm<>'DELETE' or p_confirm is null then raise exception 'Confirmation required'; end if;
 if p_expected_uid is null or auth.uid() is distinct from p_expected_uid then raise exception 'Account changed' using errcode='42501'; end if;
 perform maeum_internal.delete_account();
end $$;
revoke all on function public.mg_delete_account(text,uuid) from public, anon;
grant execute on function public.mg_delete_account(text,uuid) to authenticated;

-- Social archive: private images, public profiles, follows and reactions.
-- No private reflection text is copied into social tables or notifications.
alter table public.mg_entries
 add column photo_path text,
 add column comments_enabled boolean not null default true,
 add column featured boolean not null default false,
 add constraint mg_entry_photo_owner check (photo_path is null or
  (photo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}$' and split_part(photo_path,'/',1)=owner_id::text));
alter table public.mg_public_entries
 add column photo_path text,
 add column comments_enabled boolean not null default true,
 add column featured boolean not null default false,
 add column seconds integer not null default 0;
create index mg_entries_photo on public.mg_entries(photo_path) where photo_path is not null;
create index mg_public_photo on public.mg_public_entries(photo_path) where photo_path is not null;
create index mg_public_stage on public.mg_public_entries(stage,created_at desc,id);

create table public.mg_follows (
 follower_id uuid not null references public.mg_profiles(id) on delete cascade,
 following_id uuid not null references public.mg_profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(follower_id,following_id),check(follower_id<>following_id)
);
create index mg_follows_target on public.mg_follows(following_id,follower_id);
create table public.mg_likes (
 user_id uuid not null references public.mg_profiles(id) on delete cascade,
 entry_id uuid not null references public.mg_public_entries(id) on delete cascade,
 created_at timestamptz not null default now(),primary key(user_id,entry_id)
);
create index mg_likes_entry on public.mg_likes(entry_id,user_id);
create table public.mg_blocks (
 blocker_id uuid not null references public.mg_profiles(id) on delete cascade,
 blocked_id uuid not null references public.mg_profiles(id) on delete cascade,
 created_at timestamptz not null default now(),primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id)
);
create index mg_blocks_target on public.mg_blocks(blocked_id,blocker_id);
create table public.mg_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references public.mg_profiles(id) on delete cascade,
 entry_id uuid not null references public.mg_public_entries(id) on delete cascade,
 reason text not null check(reason in ('spam','harassment','privacy','other')),
 created_at timestamptz not null default now(),unique(reporter_id,entry_id)
);
create index mg_reports_entry on public.mg_reports(entry_id);
create table public.mg_notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references public.mg_profiles(id) on delete cascade,
 actor_id uuid not null references public.mg_profiles(id) on delete cascade,
 entry_id uuid references public.mg_public_entries(id) on delete cascade,
 kind text not null check(kind in ('comment','like','follow')),
 created_at timestamptz not null default now()
);
create index mg_notifications_recipient on public.mg_notifications(recipient_id,created_at desc,id);
create index mg_notifications_actor on public.mg_notifications(actor_id);
create index mg_notifications_entry on public.mg_notifications(entry_id);
create table public.mg_media_gc (
 photo_path text primary key,owner_id uuid not null references public.mg_profiles(id) on delete cascade,
 queued_at timestamptz not null default now()
);
create index mg_media_gc_owner on public.mg_media_gc(owner_id);
create table maeum_internal.write_windows (
 actor_id uuid not null references auth.users(id) on delete cascade,
 action text not null,window_at timestamptz not null,used integer not null,
 primary key(actor_id,action,window_at)
);
alter table maeum_internal.write_windows enable row level security;
revoke all on maeum_internal.write_windows from public,anon,authenticated;

create function maeum_internal.is_blocked(other uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.mg_blocks where
 (blocker_id=auth.uid() and blocked_id=other) or (blocked_id=auth.uid() and blocker_id=other));
$$;
revoke all on function maeum_internal.is_blocked(uuid) from public;
grant usage on schema maeum_internal to anon,authenticated;
grant execute on function maeum_internal.is_blocked(uuid) to anon,authenticated;

alter table public.mg_follows enable row level security;
alter table public.mg_likes enable row level security;
alter table public.mg_blocks enable row level security;
alter table public.mg_reports enable row level security;
alter table public.mg_notifications enable row level security;
alter table public.mg_media_gc enable row level security;
revoke all on public.mg_follows,public.mg_likes,public.mg_blocks,public.mg_reports,public.mg_notifications,public.mg_media_gc from public,anon,authenticated;
grant select on public.mg_follows,public.mg_likes to anon,authenticated;
grant insert,delete on public.mg_follows,public.mg_likes to authenticated;
grant select,insert,delete on public.mg_blocks to authenticated;
grant select,insert on public.mg_reports to authenticated;
grant select,delete on public.mg_notifications,public.mg_media_gc to authenticated;
grant insert on public.mg_media_gc to authenticated;
create policy follows_read on public.mg_follows for select to anon,authenticated using(not maeum_internal.is_blocked(follower_id) and not maeum_internal.is_blocked(following_id));
create policy follows_insert on public.mg_follows for insert to authenticated with check(follower_id=(select auth.uid()) and not maeum_internal.is_blocked(following_id));
create policy follows_delete on public.mg_follows for delete to authenticated using(follower_id=(select auth.uid()));
create policy likes_read on public.mg_likes for select to anon,authenticated using(not maeum_internal.is_blocked(user_id) and exists(select 1 from public.mg_public_entries p where p.id=entry_id));
create policy likes_insert on public.mg_likes for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.mg_public_entries p where p.id=entry_id));
create policy likes_delete on public.mg_likes for delete to authenticated using(user_id=(select auth.uid()));
create policy blocks_read on public.mg_blocks for select to authenticated using(blocker_id=(select auth.uid()));
create policy blocks_insert on public.mg_blocks for insert to authenticated with check(blocker_id=(select auth.uid()));
create policy blocks_delete on public.mg_blocks for delete to authenticated using(blocker_id=(select auth.uid()));
create policy reports_read on public.mg_reports for select to authenticated using(reporter_id=(select auth.uid()));
create policy reports_insert on public.mg_reports for insert to authenticated with check(reporter_id=(select auth.uid()) and exists(select 1 from public.mg_public_entries p where p.id=entry_id));
create policy notifications_read on public.mg_notifications for select to authenticated using(recipient_id=(select auth.uid()) and not maeum_internal.is_blocked(actor_id));
create policy notifications_delete on public.mg_notifications for delete to authenticated using(recipient_id=(select auth.uid()));
create policy media_gc_read on public.mg_media_gc for select to authenticated using(owner_id=(select auth.uid()));
create policy media_gc_insert on public.mg_media_gc for insert to authenticated with check(owner_id=(select auth.uid()) and split_part(photo_path,'/',1)=(select auth.uid())::text and photo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}$');
create policy media_gc_delete on public.mg_media_gc for delete to authenticated using(owner_id=(select auth.uid()));
alter policy profiles_read on public.mg_profiles using(not maeum_internal.is_blocked(id));
alter policy public_entries_read on public.mg_public_entries using(not maeum_internal.is_blocked(owner_id));
alter policy comments_read on public.mg_comments using(not maeum_internal.is_blocked(author_id) and exists(select 1 from public.mg_public_entries e where e.id=entry_id));
alter policy comments_insert on public.mg_comments with check(author_id=(select auth.uid()) and exists(select 1 from public.mg_public_entries e where e.id=entry_id and e.comments_enabled));

create function maeum_internal.social_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();recipient uuid;post_id uuid;event_kind text;count_used integer;limit_value integer;
begin
 if who is null or not exists(select 1 from auth.users where id=who) then raise exception 'Sign in required' using errcode='42501'; end if;
 if tg_table_name='mg_follows' then
  if new.follower_id<>who then raise exception 'Owner required' using errcode='42501'; end if;
  recipient:=new.following_id;event_kind:='follow';limit_value:=30;
 elsif tg_table_name='mg_likes' then
  if new.user_id<>who then raise exception 'Owner required' using errcode='42501'; end if;
  post_id:=new.entry_id;event_kind:='like';limit_value:=60;
 elsif tg_table_name='mg_comments' then
  if new.author_id<>who then raise exception 'Owner required' using errcode='42501'; end if;
  post_id:=new.entry_id;event_kind:='comment';limit_value:=10;
 elsif tg_table_name='mg_reports' then
  if new.reporter_id<>who then raise exception 'Owner required' using errcode='42501'; end if;
  post_id:=new.entry_id;limit_value:=5;
 elsif tg_table_name='mg_blocks' then
  if new.blocker_id<>who then raise exception 'Owner required' using errcode='42501'; end if;
  limit_value:=20;
 end if;
 delete from maeum_internal.write_windows where actor_id=who and window_at<now()-interval '2 days';
 -- Persist rate counters independently of deletable likes/comments.
 insert into maeum_internal.write_windows(actor_id,action,window_at,used)
 values(who,tg_table_name,date_trunc('minute',clock_timestamp()),1)
 on conflict(actor_id,action,window_at) do update set used=maeum_internal.write_windows.used+1
 returning used into count_used;
 if count_used>limit_value then raise exception '잠시 뒤 다시 시도해주세요.' using errcode='P0001'; end if;
 if post_id is not null then select owner_id into recipient from public.mg_public_entries where id=post_id; end if;
 if recipient is not null and exists(select 1 from public.mg_blocks where (blocker_id=who and blocked_id=recipient) or (blocker_id=recipient and blocked_id=who)) then raise exception '이 계정과는 반응을 나눌 수 없어요.' using errcode='42501'; end if;
 if tg_table_name='mg_comments' and not exists(select 1 from public.mg_public_entries where id=post_id and comments_enabled) then raise exception '댓글을 남길 수 없는 기록이에요.' using errcode='42501'; end if;
 new.created_at:=clock_timestamp();
 return new;
end $$;
revoke all on function maeum_internal.social_write() from public,anon,authenticated;
create trigger guard_follow before insert on public.mg_follows for each row execute function maeum_internal.social_write();
create trigger guard_like before insert on public.mg_likes for each row execute function maeum_internal.social_write();
create trigger guard_comment before insert on public.mg_comments for each row execute function maeum_internal.social_write();
create trigger guard_report before insert on public.mg_reports for each row execute function maeum_internal.social_write();
create trigger guard_block before insert on public.mg_blocks for each row execute function maeum_internal.social_write();

create function maeum_internal.social_effects() returns trigger
language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();recipient uuid;post_id uuid;event_kind text;
begin
 if who is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if tg_table_name='mg_blocks' then
  if new.blocker_id<>who then raise exception 'Owner required' using errcode='42501'; end if;
  delete from public.mg_follows where (follower_id=who and following_id=new.blocked_id) or (following_id=who and follower_id=new.blocked_id);
  delete from public.mg_notifications where (recipient_id=who and actor_id=new.blocked_id) or (actor_id=who and recipient_id=new.blocked_id);
  return new;
 elsif tg_table_name='mg_follows' then recipient:=new.following_id;event_kind:='follow';
 elsif tg_table_name='mg_likes' then post_id:=new.entry_id;event_kind:='like';
 else post_id:=new.entry_id;event_kind:='comment';end if;
 if post_id is not null then select owner_id into recipient from public.mg_public_entries where id=post_id;end if;
 if recipient is not null and recipient<>who then
  -- Toggle/retry floods cannot produce duplicate reaction notifications.
  if event_kind='comment' or not exists(select 1 from public.mg_notifications where recipient_id=recipient and actor_id=who and kind=event_kind and entry_id is not distinct from post_id) then
   insert into public.mg_notifications(recipient_id,actor_id,entry_id,kind) values(recipient,who,post_id,event_kind);
  end if;
 end if;
 return new;
end $$;
revoke all on function maeum_internal.social_effects() from public,anon,authenticated;
create trigger follow_effects after insert on public.mg_follows for each row execute function maeum_internal.social_effects();
create trigger like_effects after insert on public.mg_likes for each row execute function maeum_internal.social_effects();
create trigger comment_effects after insert on public.mg_comments for each row execute function maeum_internal.social_effects();
create trigger block_effects after insert on public.mg_blocks for each row execute function maeum_internal.social_effects();

create or replace function maeum_internal.project_entry() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid()<>new.owner_id then raise exception 'Owner required' using errcode='42501';end if;
 if tg_op='UPDATE' and old.photo_path is not null and (new.deleted or new.photo_path is distinct from old.photo_path) then
  insert into public.mg_media_gc(photo_path,owner_id) values(old.photo_path,old.owner_id) on conflict do nothing;
 end if;
 if new.visibility='public' and not new.deleted then
  if new.featured and not exists(select 1 from public.mg_public_entries where id=new.id and featured) and (select count(*) from public.mg_public_entries where owner_id=new.owner_id and featured)>=4 then raise exception '대표 기록은 네 개까지 고를 수 있어요.';end if;
  insert into public.mg_public_entries(id,owner_id,note,context,wine_name,vintage,stage,created_at,updated_at,photo_path,comments_enabled,featured,seconds)
  values(new.id,new.owner_id,new.note,new.context,new.wine_name,new.vintage,new.stage,new.created_at,new.updated_at,new.photo_path,new.comments_enabled,new.featured,new.seconds)
  on conflict(id) do update set note=excluded.note,context=excluded.context,wine_name=excluded.wine_name,vintage=excluded.vintage,stage=excluded.stage,updated_at=excluded.updated_at,photo_path=excluded.photo_path,comments_enabled=excluded.comments_enabled,featured=excluded.featured,seconds=excluded.seconds;
 else delete from public.mg_public_entries where id=new.id;end if;
 return new;
end $$;

-- Storage remains private. Every download checks the current publication state;
-- no long-lived signed URLs survive a switch back to private.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('maeum-photos','maeum-photos',false,1500000,array['image/jpeg'])
 on conflict(id) do update set public=false,file_size_limit=1500000,allowed_mime_types=array['image/jpeg'];
create policy maeum_photo_read on storage.objects for select to anon,authenticated using(
 bucket_id='maeum-photos' and (
  (split_part(name,'/',1)=(select auth.uid())::text and exists(select 1 from public.mg_profiles where id=(select auth.uid())))
  or exists(select 1 from public.mg_public_entries p where name=p.photo_path||'-full.jpg' or name=p.photo_path||'-thumb.jpg')
 ));
create policy maeum_photo_insert on storage.objects for insert to authenticated with check(
 bucket_id='maeum-photos' and split_part(name,'/',1)=(select auth.uid())::text
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}-(full|thumb)\.jpg$'
 and exists(select 1 from public.mg_profiles where id=(select auth.uid()))
);
create policy maeum_photo_delete on storage.objects for delete to authenticated using(
 bucket_id='maeum-photos' and split_part(name,'/',1)=(select auth.uid())::text
 and exists(select 1 from public.mg_profiles where id=(select auth.uid()))
);

-- Account deletion uses the Storage API first; deleting storage metadata with
-- SQL would orphan the underlying files and is deliberately not used.
create or replace function maeum_internal.delete_account() returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();
begin
 if who is null then raise exception 'Sign in required' using errcode='42501';end if;
 if exists(select 1 from storage.objects where bucket_id='maeum-photos' and split_part(name,'/',1)=who::text) then raise exception '사진 정리를 마친 뒤 계정을 삭제해주세요.';end if;
 delete from auth.users where id=who;
end $$;

create or replace function maeum_internal.mg_commit_entry(p_id uuid,p_base_revision bigint,p_mutation_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_row public.mg_entries; result_row public.mg_entries; who uuid:=auth.uid();
begin
 if who is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_base_revision is null or p_base_revision<0 or p_mutation_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid mutation'; end if;
 perform pg_advisory_xact_lock(hashtextextended(who::text, 0));
 insert into public.mg_profiles(id) values(who) on conflict(id) do nothing;
 select * into current_row from public.mg_entries where id=p_id and owner_id=who for update;
 if found then
  if current_row.mutation_id=p_mutation_id then return jsonb_build_object('status','applied','entry',to_jsonb(current_row)); end if;
  if current_row.revision<>p_base_revision or current_row.deleted then return jsonb_build_object('status','conflict','entry',to_jsonb(current_row)); end if;
  update public.mg_entries set note=p_payload->>'note',context=coalesce(p_payload->>'context',''),wine_name=coalesce(p_payload->>'wineName',''),vintage=coalesce(p_payload->>'vintage',''),stage=coalesce(p_payload->>'stage','finish'),seconds=coalesce((p_payload->>'seconds')::int,0),conversation=coalesce(p_payload->'conversation','[]'),visibility=coalesce(p_payload->>'visibility','private'),deleted=coalesce((p_payload->>'deleted')::boolean,false),mutation_id=p_mutation_id,photo_path=case when p_payload ? 'photoPath' then nullif(p_payload->>'photoPath','') else current_row.photo_path end,comments_enabled=coalesce((p_payload->>'commentsEnabled')::boolean,current_row.comments_enabled),featured=coalesce((p_payload->>'featured')::boolean,current_row.featured)
  where id=p_id and owner_id=who returning * into result_row;
 else
  if p_base_revision<>0 then return jsonb_build_object('status','missing','entry',null); end if;
  insert into public.mg_entries(id,owner_id,note,context,wine_name,vintage,stage,seconds,conversation,visibility,deleted,mutation_id,created_at,photo_path,comments_enabled)
  values(p_id,who,p_payload->>'note',coalesce(p_payload->>'context',''),coalesce(p_payload->>'wineName',''),coalesce(p_payload->>'vintage',''),coalesce(p_payload->>'stage','finish'),coalesce((p_payload->>'seconds')::int,0),coalesce(p_payload->'conversation','[]'),'private',coalesce((p_payload->>'deleted')::boolean,false),p_mutation_id,coalesce((p_payload->>'date')::timestamptz,now()),nullif(p_payload->>'photoPath',''),coalesce((p_payload->>'commentsEnabled')::boolean,true))
  returning * into result_row;
 end if;
 return jsonb_build_object('status','applied','entry',to_jsonb(result_row));
end $$;
revoke all on function maeum_internal.mg_commit_entry(uuid,bigint,uuid,jsonb) from public,anon;
grant execute on function maeum_internal.mg_commit_entry(uuid,bigint,uuid,jsonb) to authenticated;
create or replace function public.mg_commit_entry(p_id uuid,p_base_revision bigint,p_mutation_id uuid,p_payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select maeum_internal.mg_commit_entry(p_id,p_base_revision,p_mutation_id,p_payload);
$$;
revoke insert,update on public.mg_entries from authenticated;

create function maeum_internal.prepare_social_entry() returns trigger language plpgsql set search_path='' as $$
begin
 if new.deleted then new.photo_path:=null;new.featured:=false;end if;
 if new.photo_path is not null and (tg_op='INSERT' or new.photo_path is distinct from old.photo_path) then
  if not exists(select 1 from storage.objects where bucket_id='maeum-photos' and name=new.photo_path||'-full.jpg')
   or not exists(select 1 from storage.objects where bucket_id='maeum-photos' and name=new.photo_path||'-thumb.jpg') then raise exception '사진 업로드를 마친 뒤 저장해주세요.';end if;
 end if;
 return new;
end $$;
revoke all on function maeum_internal.prepare_social_entry() from public,anon,authenticated;
create trigger prepare_social_entry before insert or update on public.mg_entries for each row execute function maeum_internal.prepare_social_entry();

create function public.mg_feed(p_following boolean default false,p_stage text default null,p_owner uuid default null,p_before_at timestamptz default null,p_after_id uuid default null)
returns setof public.mg_public_entries language sql stable security invoker set search_path='' as $$
 select e.* from public.mg_public_entries e
 where (not p_following or exists(select 1 from public.mg_follows f where f.follower_id=auth.uid() and f.following_id=e.owner_id))
 and (p_stage is null or e.stage=p_stage) and (p_owner is null or e.owner_id=p_owner)
 and (p_before_at is null or e.created_at<p_before_at or (e.created_at=p_before_at and e.id>p_after_id))
 order by e.created_at desc,e.id;
$$;
revoke all on function public.mg_feed(boolean,text,uuid,timestamptz,uuid) from public;
grant execute on function public.mg_feed(boolean,text,uuid,timestamptz,uuid) to anon,authenticated;

-- Drop stale counters opportunistically; no text or journal content is logged.
delete from maeum_internal.write_windows where window_at<now()-interval '2 days';

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
