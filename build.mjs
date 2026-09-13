import {readFile,writeFile,mkdir,copyFile,cp,rm,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['mobile/build.mjs'],{stdio:'inherit'});
await rm('dist/mobile',{recursive:true,force:true});await cp('mobile/www','dist/mobile',{recursive:true});
const assets={};
const names=['index.html','app.js','community.mjs','client-api.mjs','model.mjs','tasting.mjs','styles.css','community.css','favicon.svg','wine-moment.webp'];
for(const name of await readdir('dist/mobile',{recursive:true})){if(!name.endsWith('/')&&name.includes('.'))names.push('mobile/'+name);}
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',mjs:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml',webp:'image/webp',png:'image/png',woff2:'font/woff2',txt:'text/plain; charset=utf-8',json:'application/json',webmanifest:'application/manifest+json'};
for(const name of names){const bytes=await readFile('dist/'+name);assets['/'+name]={data:bytes.toString('base64'),type:types[name.split('.').pop()]};}
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await writeFile('dist/server/assets.mjs','export default '+JSON.stringify(assets)+';\n');
await copyFile('server/api.mjs','dist/server/api.mjs');await copyFile('server/index.mjs','dist/server/index.js');
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
await rm('dist/.openai/drizzle',{recursive:true,force:true});await cp('drizzle','dist/.openai/drizzle',{recursive:true});
console.log('Built ESM Worker, '+names.length+' embedded assets, and D1 migrations.');
