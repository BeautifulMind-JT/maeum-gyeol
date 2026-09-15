import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {captureOAuthCallback,createGoogleLogin} from '../mobile/src/oauth.mjs';

const baseUrl='https://test-project.supabase.co',origin='https://preview.example.test';
const markerKey='maeum-gyeol:google-login';
const memory=()=>{const values=new Map();return {values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
function harness(options={}){
 const storage=memory(),calls={start:[],exchange:[],navigate:[],settings:0};let time=100000;
 const location={protocol:'https:',origin,assign:url=>calls.navigate.push(url)};
 const auth={
  signInWithOAuth:async args=>{calls.start.push(args);return {data:{url:baseUrl+'/auth/v1/authorize?'+new URLSearchParams({provider:'google',redirect_to:args.options.redirectTo,skip_http_redirect:'true'}),flowId:'a'.repeat(32)}};},
  exchangeCodeForSession:async(code,opts)=>{calls.exchange.push({code,opts});return {data:{session:{user:{id:'synthetic-user'}}}};},
 };
 const settings=async()=>{calls.settings++;return {ok:true,json:async()=>({external:{google:true}})};};
 const google=createGoogleLogin({auth,baseUrl,publishableKey:'sb_publishable_test',location,storage:()=>storage,fetcher:settings,now:()=>time,...options});
 return {google,auth,storage,calls,setTime:value=>{time=value;}};
}

test('callback credentials are stripped synchronously while unrelated query data survives',()=>{
 let cleaned;
 const result=captureOAuthCallback({href:origin+'/mobile/?code=one-use&sb_flow_id=flow&campaign=summer#journal'},{replaceState:(_a,_b,url)=>{cleaned=url;}});
 assert.deepEqual(result,{active:true,code:'one-use',error:false});
 assert.equal(cleaned,'/mobile/?campaign=summer#account');
});

test('cancelled, duplicate and implicit callbacks never produce an exchangeable code',()=>{
 for(const suffix of ['?error=access_denied&error_description=private-details','?code=one&code=two','#access_token=private-token&refresh_token=private-refresh','?code=one#provider_token=private-google-token']){
  let cleaned;const result=captureOAuthCallback({href:origin+'/mobile/'+suffix},{replaceState:(_a,_b,url)=>{cleaned=url;}});
  assert.equal(result.active,true);assert.equal(result.code,null);assert.equal(result.error,true);
  assert.equal(cleaned,'/mobile/#account');
 }
 assert.deepEqual(captureOAuthCallback({href:origin+'/mobile/#journal'},{replaceState(){assert.fail('ordinary navigation must remain intact');}}),{active:false});
});

test('Google start fixes callback origin and stores only an expiring navigation marker',async()=>{
 const h=harness();await h.google.start({kind:'editor',value:{note:'private reflection'}});
 assert.deepEqual(h.calls.start[0],{provider:'google',options:{redirectTo:origin+'/mobile/',skipBrowserRedirect:true}});
 assert.deepEqual(JSON.parse(h.storage.getItem(markerKey)),{kind:'account',createdAt:100000,flowId:'a'.repeat(32)});
 assert.ok(!h.storage.getItem(markerKey).includes('private reflection'));
 const target=new URL(h.calls.navigate[0]);assert.equal(target.origin,baseUrl);assert.equal(target.searchParams.has('skip_http_redirect'),false);
});

test('a successful callback exchanges once and consumes its navigation marker',async()=>{
 const h=harness();await h.google.start('journal');
 assert.equal(await h.google.finish({active:true,code:'synthetic-code'}),'journal');
 assert.deepEqual(h.calls.exchange,[{code:'synthetic-code',opts:{flowId:'a'.repeat(32)}}]);
 assert.equal(h.storage.getItem(markerKey),null);
 await assert.rejects(h.google.finish({active:true,code:'synthetic-code'}));assert.equal(h.calls.exchange.length,1);
});

test('missing, expired, future, corrupt and cancelled markers never exchange',async()=>{
 for(const state of ['missing','expired','future','corrupt','cancelled']){
  const h=harness();await h.google.start('editor');
  if(state==='missing')h.storage.removeItem(markerKey);
  if(state==='expired')h.setTime(100000+21*60*1000);
  if(state==='future')h.setTime(99999);
  if(state==='corrupt')h.storage.setItem(markerKey,'{');
  await assert.rejects(h.google.finish({active:true,code:'synthetic-code',error:state==='cancelled'}));
  assert.equal(h.calls.exchange.length,0,state);assert.equal(h.storage.getItem(markerKey),null);
 }
});

test('exchange failure is sanitized and does not call signOut',async()=>{
 const h=harness();await h.google.start();
 h.auth.exchangeCodeForSession=async()=>({error:Error('private-token https://secret.example.test')});
 h.auth.signOut=()=>assert.fail('failed Google login must not log out an existing session');
 await assert.rejects(h.google.finish({active:true,code:'synthetic-code'}),error=>!error.message.includes('private-token')&&error.message.includes('이메일'));
 assert.equal(h.storage.getItem(markerKey),null);
});

test('untrusted authorization URLs are rejected before navigation',async()=>{
 for(const url of ['https://evil.example.test/auth/v1/authorize',baseUrl+'/unexpected',baseUrl+'/auth/v1/authorize?provider=google&redirect_to=https://evil.example.test']){
  const h=harness();h.auth.signInWithOAuth=async()=>({data:{url}});
  await assert.rejects(h.google.start());assert.equal(h.calls.navigate.length,0);assert.equal(h.storage.getItem(markerKey),null);
 }
});

test('provider off, failed settings and native runtime preserve email-only availability',async()=>{
 for(const options of [{native:true},{fetcher:async()=>({ok:true,json:async()=>({external:{google:false}})})},{fetcher:async()=>{throw Error('offline');}}]){
  const h=harness(options);assert.equal(await h.google.available(),false);await assert.rejects(h.google.start());assert.equal(h.calls.start.length,0);
 }
 const h=harness({storage:()=>{throw Error('blocked');}});await assert.rejects(h.google.start());assert.equal(h.calls.start.length,0);
});

test('installed Supabase SDK generates PKCE and exchanges the matching verifier through real auth storage',async()=>{
 const authStorage=memory(),navigation=memory(),requests=[];let authorizeUrl;
 const expiresAt=Math.floor(Date.now()/1000)+3600;
 const token=[{alg:'HS256',typ:'JWT'},{sub:'synthetic-user',exp:expiresAt},'synthetic'].map(v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url')).join('.');
 const fakeSession={access_token:token,refresh_token:'synthetic-refresh',token_type:'bearer',expires_in:3600,user:{id:'synthetic-user',aud:'authenticated'}};
 const client=createClient(baseUrl,'sb_publishable_test',{auth:{storage:authStorage,storageKey:'test-google-auth',persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,flowType:'pkce'},global:{fetch:async(url,init)=>{
  const body=JSON.parse(init.body);requests.push({url,body});
  assert.ok(String(url).endsWith('/token?grant_type=pkce'));
  assert.equal(createHash('sha256').update(body.code_verifier).digest('base64url'),new URL(authorizeUrl).searchParams.get('code_challenge'));
  return new Response(JSON.stringify(fakeSession),{status:200,headers:{'Content-Type':'application/json'}});
 }}});
 const google=createGoogleLogin({auth:client.auth,baseUrl,publishableKey:'sb_publishable_test',location:{protocol:'https:',origin,assign:url=>{authorizeUrl=url;}},storage:()=>navigation,fetcher:async()=>({ok:true,json:async()=>({external:{google:true}})})});
 await google.start('journal');
 assert.equal(new URL(authorizeUrl).searchParams.get('code_challenge_method'),'s256');
 assert.equal(requests.length,0,'starting Google must not send an email or create a synthetic user');
 assert.equal(await google.finish({active:true,code:'synthetic-code'}),'journal');
 assert.equal(requests.length,1);assert.equal((await client.auth.getSession()).data.session.user.id,'synthetic-user');
 assert.ok(![...navigation.values.values()].some(v=>v.includes('synthetic-refresh')));
 client.auth.stopAutoRefresh();
});
