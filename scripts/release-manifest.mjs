import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=process.argv[2]||'cloudflare-dist';
const sha=b=>createHash('sha256').update(b).digest('hex');
const files=[];
for(const path of (await readdir(root,{recursive:true,withFileTypes:true})).filter(x=>x.isFile()).map(x=>x.parentPath.slice(root.length+1)+(x.parentPath===root?'':'/')+x.name).sort()){
 const bytes=await readFile(root+'/'+path);files.push({path,size:bytes.length,sha256:sha(bytes)});
}
const manifest={version:JSON.parse(await readFile('package.json','utf8')).version,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceTree:execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim(),node:process.version,lockfileSha256:sha(await readFile('package-lock.json')),files};
manifest.outputDirectory=root;
await writeFile('release-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Manifest:',manifest.commit,files.length,'files');
