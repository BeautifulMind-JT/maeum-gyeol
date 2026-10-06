import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Run the production account view with browser primitives replaced to verify the
// App Review password path and the required terms consent, without any network.
const source=(await readFile(new URL('../mobile/src/cloud-ui.mjs',import.meta.url),'utf8'))
 .replace(/^import .*;\r?\n/gm,'').replace('export function createCloudUI','function createCloudUI');
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function harness({reviewerEmail='',consent=true}={}){
 const listeners={},calls={sendCode:[],verifyCode:[],passwords:[],afterLogin:0},toasts=[];
 const main={innerHTML:''},codeForm={hidden:true},reviewerForm={hidden:true},consentBox={checked:consent};
 let view='home',user=null;
 const cloud={
  google:{available:async()=>false},
  reviewerEmail,
  sendCode:async email=>{calls.sendCode.push(email);},
  verifyCode:async(email,token)=>{calls.verifyCode.push({email,token});user={id:'otp-user'};},
  signInWithPassword:async(email,password)=>{calls.passwords.push({email,password});user={id:'review-user'};},
  user:async()=>user,
 };
 const ctx={main,native:true,cloud:()=>cloud,user:()=>user,current:()=>view,
  leave:async()=>{},screen:name=>{view=name;},googleLoginBlocked:()=>false,
  startGoogle:async()=>{},toast:value=>toasts.push(value),
  changeUser:async value=>{user=value;},afterLogin:async()=>{calls.afterLogin++;},
 };
 const document={addEventListener:(type,fn)=>{listeners[type]=fn;},
  querySelector:selector=>selector==='#cloud-code'?codeForm:selector==='#cloud-reviewer'?reviewerForm:selector==='#policy-consent'?consentBox:null};
 const context=vm.createContext({document,ctx,createSocialUI:()=>({}),esc:value=>String(value??''),icon:()=>'',Date});
 vm.runInContext(source+'\nglobalThis.ui=createCloudUI(ctx);',context,{filename:'cloud-ui.mjs'});
 return {ui:context.ui,main,calls,toasts,codeForm,reviewerForm,consentBox,
  async submit(form){const button={disabled:false,isConnected:true};form.querySelector=()=>button;let prevented=false;listeners.submit({target:form,preventDefault(){prevented=true;}});await tick();assert.equal(prevented,true);return button;},
 };
}

test('the sign-in screen shows required consent with links to terms, privacy and support',async()=>{
 const h=harness();await h.ui.account();
 assert.match(h.main.innerHTML,/id="policy-consent"/);
 assert.match(h.main.innerHTML,/\(필수\).*동의/);
 for(const policy of ['terms','privacy','support'])assert.match(h.main.innerHTML,new RegExp('data-policy="'+policy+'"'));
 assert.match(h.main.innerHTML,/무관용/,'the UGC zero-tolerance rule is named before sign-up');
});

test('sign-up requires the explicit consent before any code is sent',async()=>{
 const h=harness({consent:false});await h.ui.account();
 await h.submit({id:'cloud-email',elements:{email:{value:'reader@example.invalid'}}});
 assert.deepEqual(h.calls.sendCode,[]);assert.equal(h.codeForm.hidden,true);
 assert.equal(h.toasts.length,1);assert.match(h.toasts[0],/동의/);
 h.consentBox.checked=true;
 await h.submit({id:'cloud-email',elements:{email:{value:'reader@example.invalid'}}});
 assert.deepEqual(h.calls.sendCode,['reader@example.invalid']);assert.equal(h.codeForm.hidden,false);
});

test('without a configured reviewer email there is no password path at all',async()=>{
 const h=harness();await h.ui.account();
 assert.doesNotMatch(h.main.innerHTML,/id="cloud-reviewer"/);
 await h.submit({id:'cloud-email',elements:{email:{value:'review@apple.invalid'}}});
 assert.deepEqual(h.calls.sendCode,['review@apple.invalid'],'unknown emails keep the OTP flow');
});

test('the configured reviewer email opens password sign-in instead of sending OTP mail',async()=>{
 const h=harness({reviewerEmail:'review@apple.invalid'});await h.ui.account();
 assert.match(h.main.innerHTML,/id="cloud-reviewer"/);
 await h.submit({id:'cloud-email',elements:{email:{value:' Review@Apple.invalid '}}});
 assert.deepEqual(h.calls.sendCode,[],'no OTP mail for the demo account');
 assert.equal(h.reviewerForm.hidden,false);assert.equal(h.codeForm.hidden,true);
 await h.submit({id:'cloud-reviewer',elements:{password:{value:'demo-password'}}});
 assert.deepEqual(h.calls.passwords,[{email:'review@apple.invalid',password:'demo-password'}]);
 assert.equal(h.calls.afterLogin,1);
});

test('other emails keep the OTP flow even when a reviewer email is configured',async()=>{
 const h=harness({reviewerEmail:'review@apple.invalid'});await h.ui.account();
 await h.submit({id:'cloud-email',elements:{email:{value:'reader@example.invalid'}}});
 assert.deepEqual(h.calls.sendCode,['reader@example.invalid']);
 assert.equal(h.reviewerForm.hidden,true);assert.equal(h.codeForm.hidden,false);
 await h.submit({id:'cloud-code',elements:{code:{value:'123456'}}});
 assert.deepEqual(h.calls.verifyCode,[{email:'reader@example.invalid',token:'123456'}]);
 assert.deepEqual(h.calls.passwords,[]);
});
