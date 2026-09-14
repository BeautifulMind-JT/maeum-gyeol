-- Read-only application catalog fingerprint. No journal or user data.
with relations as (
 select c.*,n.nspname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where (n.nspname='public' and left(c.relname,3)='mg_') or n.nspname='maeum_internal'
), functions as (
 select p.*,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='public' and left(p.proname,3)='mg_') or n.nspname='maeum_internal'
), objects as (
 select 'table' as kind,nspname||'.'||relname as name,jsonb_build_object('rls',relrowsecurity,'forceRls',relforcerowsecurity) as value from relations where relkind in ('r','p')
 union all
 select 'column',r.nspname||'.'||r.relname||'.'||a.attname,jsonb_build_object('type',format_type(a.atttypid,a.atttypmod),'nullable',not a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) from relations r join pg_attribute a on a.attrelid=r.oid left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where r.relkind in ('r','p') and a.attnum>0 and not a.attisdropped
 union all
 select 'constraint',r.nspname||'.'||r.relname||'.'||c.conname,to_jsonb(pg_get_constraintdef(c.oid,true)) from relations r join pg_constraint c on c.conrelid=r.oid where c.contype<>'n'
 union all
 select 'index',r.nspname||'.'||r.relname,to_jsonb(pg_get_indexdef(r.oid)) from relations r where relkind='i'
 union all
 select 'trigger',r.nspname||'.'||r.relname||'.'||t.tgname,to_jsonb(pg_get_triggerdef(t.oid,true)) from relations r join pg_trigger t on t.tgrelid=r.oid where not t.tgisinternal
 union all
 select 'function',f.nspname||'.'||f.proname||'('||pg_get_function_identity_arguments(f.oid)||')',jsonb_build_object('body',f.prosrc,'language',l.lanname,'result',pg_get_function_result(f.oid),'definer',f.prosecdef,'volatility',f.provolatile,'strict',f.proisstrict,'config',f.proconfig) from functions f join pg_language l on l.oid=f.prolang
 union all
 select 'policy',schemaname||'.'||tablename||'.'||policyname,jsonb_build_object('roles',roles,'cmd',cmd,'permissive',permissive,'qual',qual,'check',with_check) from pg_policies where (schemaname='public' and left(tablename,3)='mg_') or schemaname='maeum_internal' or (schemaname='storage' and left(policyname,6)='maeum_')
 union all
 select 'table-grant',r.nspname||'.'||r.relname||':'||case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end||':'||a.privilege_type,to_jsonb(a.is_grantable) from relations r cross join lateral aclexplode(r.relacl) a where a.grantee=0 or pg_get_userbyid(a.grantee) in ('anon','authenticated')
 union all
 select 'function-grant',f.nspname||'.'||f.proname||'('||pg_get_function_identity_arguments(f.oid)||'):'||case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end||':'||a.privilege_type,to_jsonb(a.is_grantable) from functions f cross join lateral aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) a where a.grantee=0 or pg_get_userbyid(a.grantee) in ('anon','authenticated')
 union all
 select 'bucket',id,jsonb_build_object('public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types) from storage.buckets where id='maeum-photos'
)
select jsonb_agg(jsonb_build_object('kind',kind,'name',name,'value',value) order by kind,name) as snapshot from objects;
