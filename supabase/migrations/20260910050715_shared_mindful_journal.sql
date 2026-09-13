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
