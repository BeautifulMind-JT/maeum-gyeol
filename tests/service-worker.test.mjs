import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../mobile/src/sw.js',import.meta.url),'utf8');
function worker(network=async()=>new Response('new design')) {
 const handlers={},entries=new Map(),deleted=[],installed=[];
 const state={waiting:false,claimed:false};
 const key=request=>typeof request==='string'?request:request.url;
 const cache={addAll:async paths=>installed.push(...paths),match:async request=>entries.get(key(request))?.clone(),put:async(request,response)=>entries.set(key(request),response)};
 const context={URL,fetch:network,caches:{open:async()=>cache,keys:async()=>['maeum-mobile-old','maeum-mobile-__BUILD_HASH__','other-app'],delete:async name=>deleted.push(name)},self:{registration:{scope:'https://example.test/mobile/'},location:{origin:'https://example.test'},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:async()=>{state.waiting=true;},clients:{claim:async()=>{state.claimed=true;}}}};
 vm.runInNewContext(source,context);
 return {entries,deleted,installed,state,fetch(request){let promise;handlers.fetch({request,respondWith:p=>{promise=p;}});return promise;},async lifecycle(name){let promise;handlers[name]({waitUntil:p=>{promise=p;}});await promise;}};
}

test('an online refresh replaces a cached old design',async()=>{
 const request=new Request('https://example.test/mobile/');
 const w=worker(async(received,options)=>{assert.equal(received,request);assert.equal(options.cache,'no-cache');return new Response('new design');});
 w.entries.set(request.url,new Response('old design'));
 assert.equal(await (await w.fetch(request)).text(),'new design');
 assert.equal(await w.entries.get(request.url).text(),'new design');
});

test('offline static fallback never intercepts configuration or private requests',async()=>{
 const w=worker(async()=>{throw new Error('offline');});
 const request=new Request('https://example.test/mobile/main.mjs');
 w.entries.set(request.url,new Response('packaged code'));
 assert.equal(await (await w.fetch(request)).text(),'packaged code');
 for(const path of ['/mobile/cloud-config.json','/api/entries','/mobile/private.json'])assert.equal(w.fetch(new Request('https://example.test'+path)),undefined);
 assert.equal(w.fetch(new Request(request.url,{cache:'no-store'})),undefined);
 assert.equal(w.fetch(new Request(request.url,{method:'POST'})),undefined);
 assert.equal(w.fetch(new Request('https://other.test/mobile/main.mjs')),undefined);
});

test('worker activates without reloading tabs and cleans only its older caches',async()=>{
 const w=worker();await w.lifecycle('install');await w.lifecycle('activate');
 assert.equal(w.state.waiting,true);assert.equal(w.state.claimed,true);
 assert.equal(w.installed.includes('./cloud-config.json'),false);
 assert.ok(w.installed.includes('./index.html'));
 assert.deepEqual(w.deleted,['maeum-mobile-old']);
});
