import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const paths=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const problems=[];
for(const path of paths){
 if(/(^|\/)(\.env(?:\..+)?|auth\.json)$/.test(path)&&!path.endsWith('.env.example'))problems.push(path+': environment/credential file');
 if(/\.(keystore|jks|p12|mobileprovision)$/.test(path))problems.push(path+': signing material');
 let bytes;try{bytes=await readFile(path);}catch(error){if(error.code==='ENOENT')continue;throw error;}
 if(bytes.includes(0))continue;
 const text=bytes.toString();
 if(/sb_secret_[A-Za-z0-9_-]{15,}|gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))problems.push(path+': secret-like material');
 for(const token of text.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]{30,}/g)){try{const payload=JSON.parse(Buffer.from(token[1],'base64url'));if(payload.role&&payload.role!=='anon')problems.push(path+': authenticated JWT');}catch{}}
}
if(problems.length){console.error([...new Set(problems)].join('\n'));process.exit(1);}
console.log(`Checked ${paths.length} tracked source files; no matching credential/signing material found.`);
