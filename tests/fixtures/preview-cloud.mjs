// Served ONLY by scripts/dev.mjs under /preview/. Never copied to a production bundle.
export async function loadCloud(){
 const me={id:'11111111-1111-4111-8111-111111111111',email:'preview@example.test'};let signedIn=true,listener;
 async function call(action,args={}){const r=await fetch('/__preview-api/'+action,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-Preview-User':signedIn?me.id:''},body:JSON.stringify(args)});const data=await r.json();if(!r.ok)throw Object.assign(Error(data.message),{status:r.status});return data;}
 return {scope:'design-preview',user:async()=>signedIn?me:null,onAuth:fn=>{listener=fn;},signOut:async()=>{signedIn=false;listener?.(null);},ensureProfile:async()=>{},profile:()=>call('profile'),saveProfile:(name,bio)=>call('saveProfile',{name,bio}),
 remote:owner=>{const bound=(name,args)=>{if(!signedIn||owner!==me.id)throw Error('계정이 바뀌었어요.');return call(name,args);};return {pull:()=>bound('pull'),loadDraft:()=>bound('loadDraft'),commitDraft:r=>bound('commitDraft',{r}),commit:r=>bound('commit',{r}),save:(r,rev)=>bound('save',{r,rev})};},
 feed:(offset,options)=>call('feed',{options}),entry:id=>call('entry',{id}),comments:id=>call('comments',{id}),reactions:id=>call('reactions',{id}),like:(id,value)=>call('like',{id,value}),comment:(id,body,commentId)=>call('comment',{id,body,commentId}),
 publicProfile:id=>call('profile',{id}),profileCounts:id=>call('counts',{id}),featured:id=>call('featured',{id}),isFollowing:async()=>false,follow:async()=>{},people:query=>call('people',{query}),notifications:async()=>[],blocks:async()=>[],cleanupPhotos:async()=>{},
 photo:async()=>{const r=await fetch('./summer-wine.webp');return r.blob();},releasePhoto:async()=>{},sendCode:async()=>{throw Error('디자인 미리보기에서는 실제 이메일을 보내지 않아요.');},
 reviewerEmail:'reviewer@example.test',signInWithPassword:async(email,password)=>{if(!password)throw Error('비밀번호를 입력해주세요.');signedIn=true;listener?.(me);}
 };
}
