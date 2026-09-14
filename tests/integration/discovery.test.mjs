import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {publicRecords} from '../../mobile/src/public-records.mjs';
import {socialCloud} from '../../mobile/src/social-cloud.mjs';

const base=process.env.MAEUM_TEST_REST_URL;
assert.ok(base,'MAEUM_TEST_REST_URL must name the disposable PostgREST service');
const origin=new URL(base);
assert.ok(['127.0.0.1','localhost'].includes(origin.hostname),'This test must not target production');
const a='10000000-0000-4000-8000-000000000001',entry='20000000-0000-4000-8000-000000000001';
const absent='10000000-0000-4000-8000-000000000099';
const unwrap=async p=>{const {data,error}=await p;if(error)throw error;return data;};
// Supabase's gateway resolves publishable-key requests to anon. The local
// service has no gateway: remove only the dummy test Authorization header.
const client=createClient('http://localhost:54321','ci-anon',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{
 const u=new URL(input),headers=new Headers(init?.headers);headers.delete('authorization');
 return fetch(base+u.pathname.replace('/rest/v1','')+u.search,{...init,headers});
}}});
const records=publicRecords(client,unwrap);
const social=socialCloud({client,unwrap,account:()=>{throw Error('unexpected authentication');},actor:()=>{throw Error('unexpected write');}});

for(const [name,path,filter] of [
 ['table feed','/mg_public_entries',''],
 ['public detail','/mg_public_entries','&id=eq.'+entry],
 ['featured entries','/mg_public_entries','&owner_id=eq.'+a+'&featured=eq.true'],
 ['social RPC','/rpc/mg_feed','']
])test('old ambiguous author query fails: '+name,async()=>{
 const r=await fetch(base+path+'?select='+encodeURIComponent('*,author:mg_profiles(name)')+filter);
 assert.equal(r.status,300);assert.equal((await r.json()).code,'PGRST201');
});
function checkRows(rows){
 assert.equal(rows.length,2);
 assert.deepEqual(new Set(rows.map(x=>x.author.name)),new Set(['M0 작성자 A','M0 작성자 B']));
 for(const row of rows){assert.equal('conversation' in row,false);assert.notEqual(row.note,'M0 비공개 기록');}
}
test('production basic feed returns the two public records with correct authors',async()=>checkRows(await records.feed()));
test('production social feed RPC returns authors without private records',async()=>checkRows(await social.feed()));
test('production public detail returns the entry owner, not the user who liked it',async()=>{
 const row=await records.entry(entry);assert.equal(row.author.name,'M0 작성자 A');assert.equal(row.id,entry);assert.equal('conversation' in row,false);
});
test('production featured query filters by owner and featured flag',async()=>{
 const rows=await social.featured(a);assert.equal(rows.length,1);assert.equal(rows[0].id,entry);assert.equal(rows[0].author.name,'M0 작성자 A');
});
test('empty filtered feed is an empty array, not a relationship error',async()=>assert.deepEqual(await social.feed(0,{owner:absent}),[]));
test('empty featured query is an empty array',async()=>assert.deepEqual(await social.featured(absent),[]));
test('anonymous private table access is denied by actual PostgREST',async()=>{
 const r=await fetch(base+'/mg_entries?select=id');assert.ok([401,403].includes(r.status));
});

test('production comments resolve the commenter rather than the entry owner',async()=>{
 const rows=await records.comments(entry);assert.equal(rows.length,1);assert.equal(rows[0].author.name,'M0 작성자 B');assert.equal(rows[0].body,'M0 작성자 B의 댓글');
});
