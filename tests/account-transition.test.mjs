import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {STAGES,REFLECTIONS} from '../dist/tasting.mjs';

const source=await readFile(new URL('../mobile/src/main.mjs',import.meta.url),'utf8');
// Execute the production UI functions and event wiring. Only imports, boot-time
// network initialization, and browser/native primitives are replaced; no live
// account, Storage, or database is used. This is not a rendered-browser test.
const uiSource=source.replace(/^import .*;\r?\n/gm,'').replace(/^initialize\(\)\.catch\([^\n]*$/m,'');
const privateRecord={id:'private-A',date:'2026-09-14T01:00:00.000Z',note:'A-only private reflection',context:'A private place',wineName:'',vintage:'',stage:'finish',seconds:0,conversation:[],revision:0};
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
function fakeJournal(){
 const writes=[];
 return {writes,reloadDraft:async()=>null,list:async()=>[],migrate:async()=>{},storeDraft:async value=>{writes.push(structuredClone(value));return value;}};
}
async function harness(){
 const a=fakeJournal(),b=fakeJournal(),journals={A:a,B:b};
 const empty={hidden:false,textContent:'',innerHTML:'',dataset:{},setAttribute(){},focus(){},classList:{toggle(){},add(){},remove(){}}};
 const status={...empty,dataset:{}};
 const recovery={...empty,querySelector:()=>({...empty})};
 const form={elements:Object.fromEntries(['context','wineName','vintage','note','stage'].map(key=>[key,{value:privateRecord[key]}])),querySelectorAll:()=>[]};
 form.elements.commentsEnabled={checked:true};
 const main={...empty,querySelector:selector=>selector==='#draft-status'?status:selector==='#draft-recovery'?recovery:null,querySelectorAll:()=>[]};
 const dialog={...empty,open:false,close(){this.open=false;},showModal(){this.open=true;}};
 const document={body:{...empty,dataset:{}},querySelectorAll:()=>[],addEventListener(){},querySelector:selector=>selector==='main'?main:selector==='dialog'?dialog:selector==='#record-form'?form:{...empty}};
 const cloud={remote:id=>journals[id],ensureProfile:async()=>{},feed:async()=>[]};
 const context=vm.createContext({
  document,window:{scrollTo(){},addEventListener(){}},history:{replaceState(){}},location:{hostname:'test.local',hash:''},navigator:{},
  native:true,STAGES,REFLECTIONS,Intl,Date,performance,structuredClone,clearTimeout,setTimeout:()=>0,setInterval(){},
  createPhotoLoader:()=>({release(){},hydrate(){}}),createCloudUI:()=>({}),createServerJournal:remote=>remote,
  createStorageAdapter:()=>({}),bindLifecycle:async()=>{},shareMoment:async()=>{},stopSpeech(){},icon:()=>'',esc:value=>String(value??''),
  stageOf:()=>({label:'머무르기'}),entryImage:()=>'',entryHeading:r=>r.context,momentCard:r=>r.note,emptyJournal:()=>'',
  __cloud:cloud,
 });
 vm.runInContext(uiSource+`\ncloud=__cloud;globalThis.app={action,editor,detail,changeUser,snapshot:()=>({view,draft,record,account:accountUser?.id})};`,context,{filename:'main.mjs'});
 await context.app.changeUser({id:'A'});
 return {app:context.app,a,b,main};
}

test('late A draft response cannot become a draft in account B',async()=>{
 const {app,a,b,main}=await harness(),gate=deferred();a.reloadDraft=()=>gate.promise;
 const opening=app.action('restore-draft',{});
 await app.changeUser({id:'B'});gate.resolve(privateRecord);await opening;
 assert.equal(b.writes.length,0,'B must never receive A private draft');
 assert.equal(app.snapshot().view,'home');assert.ok(!main.innerHTML.includes(privateRecord.note));
});

test('late A private record response cannot reappear after account B cleared the UI',async()=>{
 const {app,a,main}=await harness(),gate=deferred();a.list=()=>gate.promise;
 const opening=app.action('entry',{dataset:{id:privateRecord.id}});
 await app.changeUser({id:'B'});gate.resolve([privateRecord]);await opening;
 assert.equal(app.snapshot().record,null);assert.equal(app.snapshot().view,'home');
 assert.ok(!main.innerHTML.includes(privateRecord.note),'A private note must stay hidden');
});

test('editor rejects account change during its initial awaited account check',async()=>{
 const {app,b}=await harness();
 const opening=app.editor(privateRecord),switching=app.changeUser({id:'B'});
 await Promise.all([opening,switching]);
 assert.equal(b.writes.length,0);assert.equal(app.snapshot().view,'home');
});

test('detail rejects account change during its awaited leave operation',async()=>{
 const {app,main}=await harness();
 const opening=app.detail(privateRecord),switching=app.changeUser({id:'B'});
 await Promise.all([opening,switching]);
 assert.equal(app.snapshot().record,null);assert.ok(!main.innerHTML.includes(privateRecord.note));
});

test('late draft response does not override newer navigation in the same account',async()=>{
 const {app,a}=await harness(),gate=deferred();a.reloadDraft=()=>gate.promise;
 const opening=app.action('restore-draft',{});await app.action('settings',{});
 gate.resolve(privateRecord);await opening;
 assert.equal(app.snapshot().view,'settings');assert.equal(a.writes.length,0);
});

test('late entry response does not override newer navigation in the same account',async()=>{
 const {app,a}=await harness(),gate=deferred();a.list=()=>gate.promise;
 const opening=app.action('entry',{dataset:{id:privateRecord.id}});await app.action('settings',{});
 gate.resolve([privateRecord]);await opening;
 assert.equal(app.snapshot().view,'settings');assert.equal(app.snapshot().record,null);
});

test('current-account draft restoration still renders and stores the original text',async()=>{
 const {app,a,b,main}=await harness();a.reloadDraft=async()=>structuredClone(privateRecord);
 await app.action('restore-draft',{});
 assert.equal(app.snapshot().view,'editor');assert.equal(a.writes.length,1);assert.equal(b.writes.length,0);
 assert.equal(a.writes[0].note,privateRecord.note);assert.ok(main.innerHTML.includes(privateRecord.note));
});

test('current-account private record opening still renders the requested record',async()=>{
 const {app,a,main}=await harness();a.list=async()=>[structuredClone(privateRecord)];
 await app.action('entry',{dataset:{id:privateRecord.id}});
 assert.equal(app.snapshot().view,'entry');assert.equal(app.snapshot().record.id,privateRecord.id);
 assert.ok(main.innerHTML.includes(privateRecord.note));
});
