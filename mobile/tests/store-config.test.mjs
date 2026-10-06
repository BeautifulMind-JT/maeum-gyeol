import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const base={...process.env,MAEUM_SUPABASE_URL:'https://example.supabase.co',MAEUM_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
const build=env=>execFileSync(process.execPath,['build.mjs'],{cwd:root,stdio:'pipe',env});
const config=async()=>JSON.parse(await readFile(new URL('www/cloud-config.json',root),'utf8'));

test('a store build with a reviewer email bundles only that email, never a secret',async()=>{
 build({...base,MAEUM_BUILD_MODE:'store',MAEUM_REVIEWER_EMAIL:' Review@Example.com '});
 const bundled=await config();
 assert.equal(bundled.reviewerEmail,'Review@Example.com');
 assert.deepEqual(Object.keys(bundled).sort(),['publishableKey','reviewerEmail','url']);
});

test('builds without the env expose no reviewer path and no legacy host',async()=>{
 build(base);
 const bundled=await config();
 assert.deepEqual(Object.keys(bundled).sort(),['publishableKey','url']);
 assert.ok(!JSON.stringify(bundled).includes('chatgpt.site'));
});

test('a malformed reviewer email fails the build instead of shipping',()=>{
 assert.throws(()=>build({...base,MAEUM_REVIEWER_EMAIL:'not-an-email'}),/MAEUM_REVIEWER_EMAIL/);
});
