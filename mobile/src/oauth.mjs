const INTENT_KEY='maeum-gyeol:google-login';
const MAX_AGE=20*60*1000;
const kinds=new Set(['account','editor','journal']);
const authFields=['code','sb_flow_id','error','error_code','error_description','access_token','refresh_token','provider_token','provider_refresh_token','token_type','expires_in','expires_at'];
const retryMessage='구글 로그인을 마치지 못했어요. 다시 시도하거나 이메일로 로그인해주세요.';

// Read once, before rendering or making requests. Never retain credentials in
// history, a return URL, an error message, or the navigation marker.
export function captureOAuthCallback(location,history){
 const url=new URL(location.href),fragment=new URLSearchParams(url.hash.slice(1));
 const active=authFields.some(key=>url.searchParams.has(key)||fragment.has(key));
 if(!active)return {active:false};
 const codes=url.searchParams.getAll('code');
 const invalid=codes.length!==1||!codes[0]||codes[0].length>4096||url.searchParams.has('error')||url.searchParams.has('error_code')||authFields.some(key=>fragment.has(key))||['access_token','refresh_token','provider_token','provider_refresh_token'].some(key=>url.searchParams.has(key));
 for(const key of authFields)url.searchParams.delete(key);
 url.hash='account';
 history.replaceState(null,'',url.pathname+url.search+url.hash);
 return {active:true,code:invalid?null:codes[0],error:invalid};
}

export function createGoogleLogin({auth,baseUrl,publishableKey,native=false,location=globalThis.location,storage=()=>globalThis.sessionStorage,fetcher=globalThis.fetch,now=Date.now}){
 const web=()=>!native&&location?.protocol==='https:';
 const clear=()=>{try{storage().removeItem(INTENT_KEY);}catch{}};
 async function available(){
  if(!web())return false;
  try{
   const response=await fetcher(baseUrl+'/auth/v1/settings',{headers:{apikey:publishableKey},cache:'no-store',signal:AbortSignal.timeout(8000)});
   return response.ok&&(await response.json()).external?.google===true;
  }catch{return false;}
 }
 async function start(kind='account',canNavigate=()=>true){
  try{
   if(!await available())throw Error();
   const redirectTo=new URL('/mobile/',location.origin).href;
   const marker={kind:kinds.has(kind)?kind:'account',createdAt:now()};
   storage().setItem(INTENT_KEY,JSON.stringify(marker));
   const {data,error}=await auth.signInWithOAuth({provider:'google',options:{redirectTo,skipBrowserRedirect:true}});
   if(error||!data?.url)throw Error();
   const target=new URL(data.url);
   if(target.origin!==baseUrl||target.pathname!=='/auth/v1/authorize'||target.username||target.password||target.searchParams.get('provider')!=='google'||target.searchParams.get('redirect_to')!==redirectTo)throw Error();
   if(data.flowId)marker.flowId=data.flowId;
   storage().setItem(INTENT_KEY,JSON.stringify(marker));
   target.searchParams.delete('skip_http_redirect');
   if(!canNavigate())throw Error();
   location.assign(target.href);
  }catch{clear();throw Error(retryMessage);}
 }
 async function finish(callback){
  if(!callback.active)return null;
  let marker;
  try{marker=JSON.parse(storage().getItem(INTENT_KEY)||'null');}catch{}
  clear();
  if(!web()||callback.error||!callback.code||!kinds.has(marker?.kind)||!Number.isFinite(marker?.createdAt)||now()-marker.createdAt<0||now()-marker.createdAt>MAX_AGE)throw Error(retryMessage);
  try{
   const {data,error}=await auth.exchangeCodeForSession(callback.code,marker.flowId?{flowId:marker.flowId}:undefined);
   if(error||!data?.session?.user)throw Error();
   return marker.kind;
  }catch{throw Error(retryMessage);}
 }
 return {available,start,finish};
}
