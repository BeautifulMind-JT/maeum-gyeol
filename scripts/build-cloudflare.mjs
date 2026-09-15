import {cp, mkdir, readdir, rm, stat, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);
// Reuse the pinned application build and existing public backend configuration.
const result=spawnSync(process.execPath,['scripts/build-production.mjs'],{cwd:root,stdio:'inherit'});
if(result.error)throw result.error;
if(result.status!==0)process.exit(result.status??1);

const output='cloudflare-dist';
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await cp('vercel-dist/mobile',join(output,'mobile'),{recursive:true});
await cp('vercel-dist/index.html',join(output,'index.html'));
await writeFile(join(output,'_redirects'),[
 '/ /mobile/ 302',
 '/legacy https://maeum-gyeol.justice-parkit.chatgpt.site/legacy/ 302',
 '/legacy/* https://maeum-gyeol.justice-parkit.chatgpt.site/legacy/:splat 302',
 '',
].join('\n'));
await writeFile(join(output,'_headers'),[
 '/*',
 '  X-Content-Type-Options: nosniff',
 '  Referrer-Policy: no-referrer',
 // Trial deployments should not become a second indexed production website.
 '  X-Robots-Tag: noindex',
 '/mobile/sw.js',
 '  Cache-Control: no-cache',
 '/mobile/cloud-config.json',
 '  Cache-Control: no-store',
 '',
].join('\n'));
// Disable Pages' implicit SPA fallback: missing assets must return a real 404.
await writeFile(join(output,'404.html'),'<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>페이지를 찾을 수 없어요 · 마음결</title><h1>페이지를 찾을 수 없어요.</h1><a href="/mobile/">마음결로 돌아가기</a></html>\n');

let files=0,bytes=0;
async function check(directory){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const path=join(directory,entry.name);
  if(entry.isDirectory()){await check(path);continue;}
  if(!entry.isFile())throw Error(`Unexpected output entry: ${path}`);
  const {size}=await stat(path);
  if(size>25*1024*1024)throw Error(`Pages asset exceeds 25 MiB: ${path}`);
  files++;bytes+=size;
 }
}
await check(output);
if(files>20000)throw Error('Pages Free file count exceeded.');
console.log(JSON.stringify({target:'Cloudflare Pages trial',directory:output,files,bytes}));
