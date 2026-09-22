import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Exercise the public default build, including provider routing and inventory.
test('default build creates the Pages app with a verifiable commit and complete manifest',async()=>{
 const sha='a'.repeat(40);
 execFileSync('npm',['run','build'],{stdio:'pipe',env:{...process.env,CF_PAGES_COMMIT_SHA:sha}});
 const read=path=>readFile('cloudflare-dist/'+path,'utf8');
 const identity=JSON.parse(await read('version.json'));
 assert.equal(identity.commit,sha);assert.equal(identity.target,'Cloudflare Pages');
 assert.match(await read('_redirects'),/^\/ \/mobile\/ 302/m);
 assert.match(await read('_headers'),/\/version.json\n  Cache-Control: no-store/);
 assert.match(await read('404.html'),/ページ|페이지/);
 assert.match(await read('mobile/index.html'),/src="\.\/main.mjs"/);
 const config=JSON.parse(await read('mobile/cloud-config.json'));
 assert.match(config.url,/^https:\/\/[a-z0-9]+\.supabase\.co$/);
 assert.match(config.publishableKey,/^sb_publishable_/);
 execFileSync('npm',['run','release:manifest'],{stdio:'pipe'});
 const manifest=JSON.parse(await readFile('release-manifest.json','utf8'));
 assert.equal(manifest.outputDirectory,'cloudflare-dist');
 for(const path of ['_redirects','_headers','404.html','version.json','mobile/main.mjs']){
  const entry=manifest.files.find(file=>file.path===path);assert.ok(entry,path);
  assert.equal(entry.sha256,createHash('sha256').update(await read(path)).digest('hex'));
 }
 assert.ok(!manifest.files.some(file=>/fixtures|preview-cloud|vercel.json/.test(file.path)));
});
