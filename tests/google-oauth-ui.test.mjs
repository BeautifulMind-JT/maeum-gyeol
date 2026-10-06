import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Run the production account view and its document event handlers with browser
// primitives and the cloud transport replaced. No OAuth provider is contacted.
const source=(await readFile(new URL('../mobile/src/cloud-ui.mjs',import.meta.url),'utf8'))
 .replace(/^import .*;\r?\n/gm,'').replace('export function createCloudUI','function createCloudUI');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}

function harness({available=async()=>false,native=false,blocked=false,consent=true}={}){
 const listeners={},calls={available:0,startGoogle:0,sendCode:[],verifyCode:[],afterLogin:0},toasts=[];
 const main={innerHTML:''},codeForm={hidden:true},consentBox={checked:consent},reviewerForm={hidden:true};let view='home',user=null;
 const cloud={
  google:{available:async()=>{calls.available++;return available();}},
  sendCode:async email=>{calls.sendCode.push(email);},
  verifyCode:async(email,token)=>{calls.verifyCode.push({email,token});user={id:'email-user'};},
  user:async()=>user,
 };
 const ctx={main,native,cloud:()=>cloud,user:()=>user,current:()=>view,
  leave:async()=>{},screen:name=>{view=name;},googleLoginBlocked:()=>blocked,
  startGoogle:async()=>{calls.startGoogle++;},toast:value=>toasts.push(value),
  changeUser:async value=>{user=value;},afterLogin:async()=>{calls.afterLogin++;},
 };
 const document={addEventListener:(type,fn)=>{listeners[type]=fn;},querySelector:selector=>selector==='#cloud-code'?codeForm:selector==='#policy-consent'?consentBox:selector==='#cloud-reviewer'?reviewerForm:null};
 const context=vm.createContext({document,ctx,createSocialUI:()=>({}),esc:value=>String(value??''),icon:()=>'',Date});
 vm.runInContext(source+'\nglobalThis.ui=createCloudUI(ctx);',context,{filename:'cloud-ui.mjs'});
 return {ui:context.ui,main,calls,toasts,codeForm,consentBox,reviewerForm,
  navigate(name,html){view=name;main.innerHTML=html;},
  async click(action){const button={dataset:{cloudAction:action},disabled:false,isConnected:true};listeners.click({target:{closest:()=>button}});await tick();return button;},
  async submit(form){const button={disabled:false,isConnected:true};form.querySelector=()=>button;let prevented=false;listeners.submit({target:form,preventDefault(){prevented=true;}});await tick();assert.equal(prevented,true);return button;},
 };
}

function assertEmailAvailable(html){
 assert.match(html,/id="cloud-email"/,'email sign-in must remain available');
 assert.match(html,/id="cloud-code"/,'numeric email verification must remain available');
}
const googleAction=/data-cloud-action="google-login"/;

test('account keeps email sign-in when the Google provider is disabled',async()=>{
 const h=harness();await h.ui.account();
 assertEmailAvailable(h.main.innerHTML);assert.doesNotMatch(h.main.innerHTML,googleAction);
 assert.equal(h.calls.available,1);
});

test('web account offers Google only after enabled-provider availability resolves',{timeout:1500},async()=>{
 const gate=deferred(),h=harness({available:()=>gate.promise});
 const opening=h.ui.account();await tick();assert.equal(h.calls.available,1);
 assert.doesNotMatch(h.main.innerHTML,googleAction,'pending availability must not advertise Google sign-in');
 gate.resolve(true);await opening;
 assert.match(h.main.innerHTML,googleAction);assertEmailAvailable(h.main.innerHTML);
});

test('native account offers email without checking or advertising web OAuth',async()=>{
 const h=harness({native:true,available:async()=>true});await h.ui.account();
 assertEmailAvailable(h.main.innerHTML);assert.doesNotMatch(h.main.innerHTML,googleAction);
 assert.equal(h.calls.available,0);
});

test('Google account action delegates to the guarded app login handler',async()=>{
 const h=harness({available:async()=>true});await h.ui.account();
 const button=await h.click('google-login');
 assert.equal(h.calls.startGoogle,1);assert.equal(button.disabled,false);assert.deepEqual(h.toasts,[]);
});

test('late provider availability cannot overwrite a newer screen',{timeout:1500},async()=>{
 const gate=deferred(),h=harness({available:()=>gate.promise});
 const opening=h.ui.account();await tick();assert.equal(h.calls.available,1);
 h.navigate('settings','newer settings view');gate.resolve(true);await opening;
 assert.equal(h.main.innerHTML,'newer settings view');
});

test('unsaved login intent keeps email flow and hides Google without checking availability',async()=>{
 const h=harness({blocked:true,available:async()=>true});await h.ui.account();
 assertEmailAvailable(h.main.innerHTML);assert.doesNotMatch(h.main.innerHTML,googleAction);
 assert.equal(h.calls.available,0);
});

test('Google login without the required terms consent is refused',async()=>{
 const h=harness({available:async()=>true,consent:false});await h.ui.account();
 const button=await h.click('google-login');
 assert.equal(h.calls.startGoogle,0);assert.equal(h.toasts.length,1);assert.match(h.toasts[0],/동의/);
 assert.equal(button.disabled,false);
});

test('email send and numeric-code verification still work with Google available',async()=>{
 const h=harness({available:async()=>true});await h.ui.account();
 await h.submit({id:'cloud-email',elements:{email:{value:' reader@example.invalid '}}});
 assert.deepEqual(h.calls.sendCode,['reader@example.invalid']);assert.equal(h.codeForm.hidden,false);
 await h.submit({id:'cloud-code',elements:{code:{value:' 123456 '}}});
 assert.deepEqual(h.calls.verifyCode,[{email:'reader@example.invalid',token:'123456'}]);
 assert.equal(h.calls.afterLogin,1);assert.equal(h.calls.startGoogle,0);
});
