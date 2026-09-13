import {createClient} from './vendor/supabase.mjs';
import {socialCloud} from './social-cloud.mjs';
export async function loadCloud(storage){
 const response=await fetch('./cloud-config.json',{cache:'no-store'});
 if(!response.ok)throw Error('계정 연결 설정을 불러오지 못했어요.');
 const config=await response.json();
 if(!config.url&&!config.publishableKey)return null;
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url)||!config.publishableKey.startsWith('sb_publishable_'))throw Error('계정 연결 설정을 확인해주세요.');
 const storageKey='maeum-'+new URL(config.url).hostname;
 const client=createClient(config.url,config.publishableKey,{auth:{storage,storageKey,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false},global:{fetch:(url,init)=>fetch(url,{...init,cache:'no-store',signal:init?.signal||AbortSignal.timeout(20000)})}});
 const unwrap=async p=>{const {data,error}=await p;if(error)throw error;return data;};
 async function user(){try{const s=await unwrap(client.auth.getSession());return s.session?.user||null;}catch(error){if(error.name!=='AuthRetryableFetchError')throw error;const cached=JSON.parse(await storage.getItem(storageKey)||'null');return cached?.user?.id?cached.user:null;}}
 const account=async()=>{const u=await user();if(!u)throw Error('로그인해주세요.');return u;};
 const actor=async()=>{const {session}=await unwrap(client.auth.getSession());if(!session)throw Error('로그인해주세요.');const token=session.access_token;
  const c=createClient(config.url,config.publishableKey,{accessToken:async()=>token,auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(url,init)=>fetch(url,{...init,cache:'no-store',signal:init?.signal||AbortSignal.timeout(20000)})}});return {c,u:session.user};};
 const social=socialCloud({client,actor,unwrap,account});
 return {
  legacyAppUrl:config.legacyAppUrl||'',
  scope:new URL(config.url).hostname.split('.')[0],
  user,
  onAuth:fn=>client.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>fn(session?.user||null),0);}),
  sendCode:email=>unwrap(client.auth.signInWithOtp({email,options:{shouldCreateUser:true}})),
  verifyCode:(email,token)=>unwrap(client.auth.verifyOtp({email,token,type:'email'})),
  signOut:()=>unwrap(client.auth.signOut({scope:'local'})),
  async profile(){const u=await account();return await unwrap(client.from('mg_profiles').select('id,name,bio').eq('id',u.id).maybeSingle());},
  async ensureProfile(){const {c,u}=await actor();return unwrap(c.from('mg_profiles').upsert({id:u.id},{onConflict:'id',ignoreDuplicates:true}));},
  async saveProfile(name,bio){const {c,u}=await actor();return unwrap(c.from('mg_profiles').upsert({id:u.id,name,bio},{onConflict:'id'}));},
  remote(owner){
   async function boundRequest(path,body){
    const {session}=await unwrap(client.auth.getSession());
    if(session?.user.id!==owner)throw Error('계정이 바뀌었어요. 다시 열어주세요.');
    // Freeze the token for this request: a concurrent account switch must never
    // cause a queued journal mutation to run under the next account's token.
    const response=await fetch(config.url+'/rest/v1/'+path,{method:body?'POST':'GET',cache:'no-store',headers:{apikey:config.publishableKey,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
    const data=await response.json();if(!response.ok)throw Object.assign(Error(data.message||'계정 기록에 연결하지 못했어요.'),{status:response.status});return data;
   }
   return {
    async commit(r){return boundRequest('rpc/mg_commit_entry',{p_id:r.id,p_base_revision:r.revision,p_mutation_id:r.mutationId,p_payload:r});},
    async save(r,draftRevision=null){return boundRequest('rpc/mg_save_entry',{p_id:r.id,p_base_revision:r.revision,p_mutation_id:r.mutationId,p_payload:r,p_draft_revision:draftRevision});},
    async loadDraft(){const q=new URLSearchParams({select:'revision,mutation_id,payload,updated_at',owner_id:'eq.'+owner,limit:'1'});return (await boundRequest('mg_drafts?'+q))[0]||null;},
    async commitDraft(r){return boundRequest('rpc/mg_commit_draft',{p_base_revision:r.revision,p_mutation_id:r.mutationId,p_payload:r.payload});},
    async pull(){let all=[],last='';for(;;){const query=new URLSearchParams({select:'*',owner_id:'eq.'+owner,order:'id.asc',limit:'200'});if(last)query.set('id','gt.'+last);const rows=await boundRequest('mg_entries?'+query);all.push(...rows);if(rows.length<200)break;last=rows.at(-1).id;}return all;}
   };
  },
  async feed(offset=0){return unwrap(client.from('mg_public_entries').select('*,author:mg_profiles(name)').order('created_at',{ascending:false}).order('id').range(offset,offset+19));},
  async entry(id){return unwrap(client.from('mg_public_entries').select('*,author:mg_profiles(name)').eq('id',id).single());},
  async comments(id,offset=0){return unwrap(client.from('mg_comments').select('*,author:mg_profiles(name)').eq('entry_id',id).order('created_at').order('id').range(offset,offset+49));},
  async comment(entryId,body,id){const u=await account();await unwrap(client.from('mg_profiles').upsert({id:u.id},{onConflict:'id',ignoreDuplicates:true}));const result=await client.from('mg_comments').insert({id,entry_id:entryId,author_id:u.id,body});if(result.error?.code==='23505'){const existing=await unwrap(client.from('mg_comments').select('id,author_id,entry_id,body').eq('id',id).single());if(existing.author_id===u.id&&existing.entry_id===entryId&&existing.body===body)return;}if(result.error)throw result.error;},
  deleteComment:id=>unwrap(client.from('mg_comments').delete().eq('id',id)),
  async exportComments(){const u=await account();let rows=[],last='';for(;;){let q=client.from('mg_comments').select('id,entry_id,body,created_at').eq('author_id',u.id).order('id').limit(200);if(last)q=q.gt('id',last);const batch=await unwrap(q);rows.push(...batch);if(batch.length<200)return rows;last=batch.at(-1).id;}},
  ...social,
  async deleteAccount(){const {c,u}=await actor();await social.deleteAccountPhotos(c,u);await unwrap(c.rpc('mg_delete_account',{p_confirm:'DELETE',p_expected_uid:u.id}));if((await user())?.id===u.id)await client.auth.signOut({scope:'local'});}
 };
}
