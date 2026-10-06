import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

// Guards for the App Review items: crisis notice, policy access, and no stale hosts.
test('the crisis notice carries the verified Korean lines and the service-scope disclaimer',async()=>{
 const policies=await read('mobile/src/policies.mjs');
 for(const number of ['109','1577-0199','112','119'])assert.ok(policies.includes("'"+number+"'"),'crisis line '+number);
 assert.match(policies,/의료·심리상담 서비스가 아니며/);
 const main=await read('mobile/src/main.mjs');
 assert.match(main,/safetySeen/,'first-use notice is gated by a stored marker');
 assert.match(main,/showSafetyNotice\(\)/,'notice is shown on first use');
 assert.match(main,/data-action="safety-notice"/,'notice stays reachable from settings');
});

test('settings link to terms, privacy and support, and policies open externally',async()=>{
 const main=await read('mobile/src/main.mjs');
 for(const policy of ['terms','privacy','support'])assert.match(main,new RegExp('data-policy="'+policy+'"'));
 assert.match(main,/openExternal\(POLICY_URLS/);
 const urls=await read('mobile/src/policies.mjs');
 for(const path of ['/terms/','/privacy/','/support/'])assert.ok(urls.includes(path));
});

test('publishing and commenting surface the UGC rules; reports promise a 24h review',async()=>{
 const cloudUI=await read('mobile/src/cloud-ui.mjs');
 assert.match(cloudUI,/무관용/);assert.match(cloudUI,/규칙에 동의하고 공개하기/);
 const socialUI=await read('mobile/src/social-ui.mjs');
 assert.match(socialUI,/커뮤니티 규칙/);assert.match(socialUI,/24시간 이내에 검토/);
});

test('the offline worker also packages the policies module',async()=>{
 assert.match(await read('mobile/src/sw.js'),/'\.\/policies\.mjs'/);
});

test('no chatgpt.site remnants are bundled into the app or its build configuration',async()=>{
 const sources=(await readdir(new URL('../mobile/src',import.meta.url))).filter(name=>/\.(mjs|html|css|json)$/.test(name));
 for(const name of sources)assert.ok(!(await read('mobile/src/'+name)).includes('chatgpt.site'),name);
 for(const path of ['config/production-public.json','mobile/build.mjs','scripts/build-vercel.mjs','scripts/build-production.mjs'])
  assert.ok(!(await read(path)).includes('chatgpt.site'),path);
});

test('no password, demo credential or secret is committed for the review account',async()=>{
 const config=JSON.parse(await read('config/production-public.json'));
 assert.deepEqual(Object.keys(config).sort(),['publishableKey','url']);
 const cloud=await read('mobile/src/cloud.mjs');
 assert.match(cloud,/signInWithPassword/);
 assert.doesNotMatch(cloud,/password\s*[:=]\s*['"][^'"]/,'no literal password in the client');
});
