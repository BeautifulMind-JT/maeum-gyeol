import {cp,mkdir,rm,copyFile,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
process.chdir(fileURLToPath(new URL('.',import.meta.url)));
await rm('www',{recursive:true,force:true});await mkdir('www/shared',{recursive:true});
await cp('src','www',{recursive:true});
await mkdir('www/vendor',{recursive:true});
await build({absWorkingDir:process.cwd(),stdin:{contents:"export {createClient} from '@supabase/supabase-js';",resolveDir:fileURLToPath(new URL('..',import.meta.url))},bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,outfile:fileURLToPath(new URL('./www/vendor/supabase.mjs',import.meta.url))});
const url=process.env.MAEUM_SUPABASE_URL||'',publishableKey=process.env.MAEUM_SUPABASE_PUBLISHABLE_KEY||'';
// Store builds silently losing account features would strand users (and risk App Review 4.2).
if(process.env.MAEUM_BUILD_MODE==='store'&&!(url&&publishableKey))throw Error('Store builds require MAEUM_SUPABASE_URL and MAEUM_SUPABASE_PUBLISHABLE_KEY; the public values are in config/production-public.json.');
if(Boolean(url)!==Boolean(publishableKey))throw Error('Both Supabase URL and publishable key are required.');
if(url&&(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!publishableKey.startsWith('sb_publishable_')))throw Error('Only a Supabase HTTPS URL and publishable key may be bundled.');
// Optional App Review demo account: only the email is bundled, never a password.
const reviewerEmail=(process.env.MAEUM_REVIEWER_EMAIL||'').trim();
if(reviewerEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reviewerEmail))throw Error('MAEUM_REVIEWER_EMAIL must be a plain email address.');
await writeFile('www/cloud-config.json',JSON.stringify({url,publishableKey,...(reviewerEmail?{reviewerEmail}:{})}));
for(const name of ['tasting.mjs','model.mjs'])await copyFile('../dist/'+name,'www/shared/'+name);
for(const name of ['wine-moment.webp','favicon.svg'])await copyFile('../dist/'+name,'www/'+name);
const hash=createHash('sha256');
for(const name of (await readdir('src')).sort())hash.update(await readFile('src/'+name));
for(const name of ['tasting.mjs','model.mjs'])hash.update(await readFile('www/shared/'+name));
hash.update(await readFile('www/vendor/supabase.mjs'));hash.update(await readFile('www/cloud-config.json'));
await writeFile('www/sw.js',(await readFile('www/sw.js','utf8')).replace('__BUILD_HASH__',hash.digest('hex').slice(0,16)));
console.log('Built bundled mobile UI, shared mindfulness guides and offline assets.');
