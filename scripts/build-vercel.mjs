import {cp,mkdir,rm,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);
if(!process.env.MAEUM_SUPABASE_URL||!process.env.MAEUM_SUPABASE_PUBLISHABLE_KEY){
 throw Error('Vercel builds require the existing Supabase URL and publishable key.');
}
const result=spawnSync(process.execPath,['mobile/build.mjs'],{cwd:root,env:process.env,stdio:'inherit'});
if(result.error)throw result.error;
if(result.status!==0)process.exit(result.status||1);
await rm('vercel-dist',{recursive:true,force:true});
await mkdir('vercel-dist',{recursive:true});
await cp('mobile/www','vercel-dist/mobile',{recursive:true});
// The 1024px native store icon is not referenced by the web app.
await rm('vercel-dist/mobile/icon-1024.png',{force:true});
await writeFile('vercel-dist/index.html','<!doctype html><html lang="ko"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/mobile/"><title>마음결</title><a href="/mobile/">마음결 열기</a></html>');
// A files-based deployment uploads this directory directly and needs no remote build.
const config=JSON.parse(await readFile('vercel.json','utf8'));
Object.assign(config,{buildCommand:'',installCommand:'',outputDirectory:'.'});
await writeFile('vercel-dist/vercel.json',JSON.stringify(config,null,2)+'\n');
console.log('Vercel static app ready; authentication and records use the existing Supabase project.');
