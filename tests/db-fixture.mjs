import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
export async function database(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,created_at timestamptz default now(),unique(bucket_id,name));alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated;grant select on storage.objects to anon;grant select,insert,delete on storage.objects to authenticated;`);
 for(const file of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 async function as(uid,fn,role=uid?'authenticated':'anon'){await db.exec('set role '+role);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid||'']);try{return await fn();}finally{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");}}
 async function user(id=crypto.randomUUID()){await db.query('insert into auth.users values($1)',[id]);await as(id,()=>db.query('insert into public.mg_profiles(id) values($1)',[id]));return id;}
 async function commit(uid,payload,revision=0,id=crypto.randomUUID(),mutation=crypto.randomUUID()){
  return as(uid,async()=>(await db.query('select public.mg_commit_entry($1,$2,$3,$4) as r',[id,revision,mutation,JSON.stringify({note:'잔을 쥔 손의 온기를 알아차렸다.',...payload})])).rows[0].r);
 }
 return {db,as,user,commit};
}
