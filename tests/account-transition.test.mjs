import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {STAGES,REFLECTIONS,TastingClock} from '../dist/tasting.mjs';
import {captureOAuthCallback,createGoogleLogin} from '../mobile/src/oauth.mjs';

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
  openExternal:async()=>{},POLICY_URLS:{terms:'',privacy:'',support:''},crisisNoticeMarkup:()=>'',
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

const cloudUISource=(await readFile(new URL('../mobile/src/cloud-ui.mjs',import.meta.url),'utf8'))
 .replace(/^import .*;\r?\n/gm,'').replace('export function createCloudUI','function createCloudUI');
const oauthTick=()=>new Promise(resolve=>setImmediate(resolve));
const flowId='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

function authHarness({callback=false,kind='account',exchangeError=false,exchangeGate=null,providerGate=null,native=false}={}){
 const location=new URL('https://app.example.invalid/mobile/'+(callback?'?code=single-use-test-code#home':''));
 const events=[],exchanges=[],redirects=[],sessionStorage=new Map();let sessionUser=null;
 if(callback)sessionStorage.set('maeum-gyeol:google-login',JSON.stringify({kind,flowId,createdAt:Date.now()}));
 location.assign=value=>redirects.push(value);
 const history={replaceState(_state,_title,value){location.href=new URL(value,location).href;events.push({type:'history',href:location.href});}};
 const empty=()=>({hidden:false,textContent:'',innerHTML:'',dataset:{},setAttribute(){},focus(){},classList:{toggle(){},add(){},remove(){}}});
 const main={...empty(),querySelector:()=>null,querySelectorAll:()=>[]};
 const dialog={...empty(),open:false,close(){this.open=false;},showModal(){this.open=true;}};
 const elements=new Map([['main',main],['dialog',dialog]]),listeners={};
 const document={body:empty(),querySelectorAll:()=>[],
  querySelector(selector){if(!elements.has(selector))elements.set(selector,empty());return elements.get(selector);},
  addEventListener(type,fn){(listeners[type]||=[]).push(fn);},
 };
 const cloud={scope:'test-project',remote:()=>fakeJournal(),ensureProfile:async()=>{},profile:async()=>null,feed:async()=>[],
  user:async()=>sessionUser,onAuth(){events.push({type:'subscription'});},
  sendCode:async()=>{},verifyCode:async()=>{},
 };
 cloud.google=createGoogleLogin({
  baseUrl:'https://test-project.supabase.co',publishableKey:'sb_publishable_test',native,location,
  storage:()=>({getItem:key=>sessionStorage.get(key)||null,setItem:(key,value)=>sessionStorage.set(key,value),removeItem:key=>sessionStorage.delete(key)}),
  fetcher:async()=>{events.push({type:'provider'});if(providerGate)await providerGate.promise;return {ok:true,json:async()=>({external:{google:true}})};},
  auth:{
   async signInWithOAuth({options}){return {data:{flowId,url:'https://test-project.supabase.co/auth/v1/authorize?'+new URLSearchParams({provider:'google',redirect_to:options.redirectTo})},error:null};},
   async exchangeCodeForSession(code){exchanges.push(code);if(exchangeGate)await exchangeGate.promise;if(exchangeError)return {data:null,error:Error('test exchange failure')};sessionUser={id:'A',email:'reader@example.invalid'};return {data:{session:{user:sessionUser}},error:null};},
  },
 });
 const context=vm.createContext({document,location,history,navigator:{},window:{scrollTo(){},addEventListener(){}},
  native,STAGES,REFLECTIONS,TastingClock,Intl,Date,performance,structuredClone,clearTimeout,setTimeout:()=>0,setInterval(){},
  createPhotoLoader:()=>({release(){events.push({type:'screen',href:location.href});},hydrate(){}}),
  createServerJournal:remote=>remote,createSocialUI:()=>({}),createStorageAdapter:()=>({}),storageAdapter:{read:async()=>null},
  createAuthStorage:()=>({}),loadCloud:async()=>{events.push({type:'network',href:location.href});return cloud;},captureOAuthCallback,
  bindLifecycle:async()=>{},shareMoment:async()=>{},stopSpeech(){},speak:async()=>{},icon:()=>'',esc:value=>String(value??''),
  newId:()=>'new-private-record',stageOf:()=>({label:'머무르기'}),entryImage:()=>'',entryHeading:r=>r.context,momentCard:r=>r.note,emptyJournal:()=>'',stats:()=>'',
  openExternal:async()=>{},POLICY_URLS:{terms:'',privacy:'',support:''},crisisNoticeMarkup:()=>'',
 });
 vm.runInContext('globalThis.createCloudUI=(()=>{'+cloudUISource+'\nreturn createCloudUI;})();',context,{filename:'cloud-ui.mjs'});
 vm.runInContext(uiSource+`\nglobalThis.app={initialize,startGoogle,googleLoginBlocked,action,editor,
  setIntent:value=>{pendingIntent=value;},account:()=>cloudUI.account(),
  snapshot:()=>({view,draft,clock:clock?.snapshot(),intent:pendingIntent,account:accountUser?.id})};`,context,{filename:'main.mjs'});
 return {app:context.app,main,events,exchanges,redirects,sessionStorage,location,elements};
}

test('OAuth callback removes credentials before the first screen and cloud request',async()=>{
 const h=authHarness({callback:true});await h.app.initialize();
 assert.equal(h.events[0].type,'history');
 const observable=h.events.filter(event=>event.type==='screen'||event.type==='network');
 assert.ok(observable.some(event=>event.type==='network'));
 assert.ok(observable.every(event=>!event.href.includes('single-use-test-code')&&!event.href.includes('code=')));
 assert.equal(h.location.search,'');assert.deepEqual(h.exchanges,['single-use-test-code']);
});

for(const kind of ['journal','account'])test('OAuth callback restores '+kind+' once after successful session exchange',async()=>{
 const h=authHarness({callback:true,kind});await h.app.initialize();
 assert.equal(h.app.snapshot().account,'A');assert.equal(h.app.snapshot().view,kind);
 assert.deepEqual(h.exchanges,['single-use-test-code']);assert.equal(h.sessionStorage.size,0);
 assert.equal(h.app.snapshot().intent,null);
});

test('failed OAuth callback leaves the email login form usable and clears the return marker',async()=>{
 const h=authHarness({callback:true,exchangeError:true});await h.app.initialize();
 assert.equal(h.app.snapshot().view,'account');assert.equal(h.app.snapshot().account,undefined);
 assert.match(h.main.innerHTML,/id="cloud-email"/);assert.match(h.main.innerHTML,/id="cloud-code"/);
 assert.equal(h.sessionStorage.size,0);assert.equal(h.location.search,'');
 assert.match(h.elements.get('.toast').textContent,/이메일/);
});

test('Google start rejects a pending private draft without storing or redirecting it',async()=>{
 const h=authHarness();await h.app.initialize();h.app.setIntent({kind:'editor',value:structuredClone(privateRecord)});
 await assert.rejects(h.app.startGoogle(),/이메일/);
 assert.equal(h.redirects.length,0);assert.equal(h.sessionStorage.size,0);
 assert.equal(h.app.snapshot().intent.value.note,privateRecord.note);
});

test('Google start rejects an ongoing practice without dropping its in-memory state',async()=>{
 const h=authHarness();await h.app.initialize();await h.app.action('start',{});
 assert.equal(h.app.snapshot().view,'practice');assert.ok(h.app.snapshot().clock);
 await assert.rejects(h.app.startGoogle(),/이메일/);
 assert.equal(h.redirects.length,0);assert.equal(h.sessionStorage.size,0);assert.ok(h.app.snapshot().clock);
});

test('late Google provider response cannot redirect after new private state appears',async()=>{
 const gate=deferred(),h=authHarness({providerGate:gate});await h.app.initialize();
 const starting=h.app.startGoogle();await oauthTick();assert.ok(h.events.some(event=>event.type==='provider'));
 h.app.setIntent({kind:'editor',value:structuredClone(privateRecord)});gate.resolve();
 await assert.rejects(starting);
 assert.equal(h.redirects.length,0);assert.equal(h.sessionStorage.size,0);
 assert.equal(h.app.snapshot().intent.value.note,privateRecord.note);
});

test('late Google provider response cannot redirect after newer navigation',async()=>{
 const gate=deferred(),h=authHarness({providerGate:gate});await h.app.initialize();
 const starting=h.app.startGoogle();await oauthTick();assert.ok(h.events.some(event=>event.type==='provider'));
 await h.app.action('settings',{});gate.resolve();await assert.rejects(starting);
 assert.equal(h.redirects.length,0);assert.equal(h.sessionStorage.size,0);assert.equal(h.app.snapshot().view,'settings');
});

test('OAuth callback initialization prevents a practice that its session update would erase',async()=>{
 const gate=deferred(),h=authHarness({callback:true,exchangeGate:gate});
 const opening=h.app.initialize();await oauthTick();assert.equal(h.exchanges.length,1);
 await h.app.action('start',{});const whileWaiting=h.app.snapshot();gate.resolve();await opening;
 assert.notEqual(whileWaiting.view,'practice','callback loading must not expose a practice that changeUser then discards');
 assert.equal(h.app.snapshot().account,'A');assert.equal(h.app.snapshot().view,'account');
});
