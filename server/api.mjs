const PUBLIC_ORIGIN = 'https://maeum-gyeol.justice-parkit.chatgpt.site';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
class ApiError extends Error { constructor(status,message){super(message);this.status=status;} }
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Cookie, oai-authenticated-user-id','X-Content-Type-Options':'nosniff'}});
const publicColumns = 'e.id, e.owner_id, e.scene, e.note, e.context, e.wine_name, e.vintage, e.stage, e.visibility, e.created_at, e.updated_at, p.name AS author_name';
function db(env){if(!env.DB)throw new ApiError(503,'기록 보관함에 연결하지 못했어요. 잠시 후 다시 시도해주세요.');return env.DB;}
function subject(request){const id=request.headers.get('oai-authenticated-user-id');const email=request.headers.get('oai-authenticated-user-email');return id && email ? id : null;}
function requireSubject(request){const id=subject(request);if(!id)throw new ApiError(401,'로그인하면 기록을 저장하고 이야기를 나눌 수 있어요.');return id;}
function textField(value,max,label,required=false){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new ApiError(400,label+'을 확인해주세요.');return value.trim();}
function validId(value){if(!UUID.test(value||''))throw new ApiError(404,'기록을 찾을 수 없어요.');return value;}
function offsetParam(url){const n=Number(url.searchParams.get('offset')||0);if(!Number.isInteger(n)||n<0||n>100000)throw new ApiError(400,'목록 위치를 확인해주세요.');return n;}
async function body(request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new ApiError(415,'요청 형식을 확인해주세요.');
 const reader=request.body?.getReader();if(!reader)throw new ApiError(400,'내용을 입력해주세요.');
 const chunks=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>24000){await reader.cancel();throw new ApiError(413,'내용이 너무 길어요.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let pos=0;for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length;}
 try {const v=JSON.parse(new TextDecoder().decode(bytes));if(!v||Array.isArray(v)||typeof v!=='object')throw Error();return v;}catch{throw new ApiError(400,'입력 내용을 확인해주세요.');}
}
function verifyWrite(request){
 const origin=request.headers.get('origin');
 const allowed=new Set([PUBLIC_ORIGIN,new URL(request.url).origin]);
 if(!origin||!allowed.has(origin)||request.headers.get('x-maeum-request')!=='1')throw new ApiError(403,'이 페이지에서 다시 시도해주세요.');
}
async function profileFor(database,sub,create=false){
 let p=await database.prepare('SELECT id, name, bio, created_at FROM profiles WHERE subject = ?').bind(sub).first();
 if(!p&&create){const id=crypto.randomUUID();await database.prepare('INSERT INTO profiles (id, subject, name, bio, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(subject) DO NOTHING').bind(id,sub,'머무는 사람 · '+id.slice(0,4),'',new Date().toISOString()).run();p=await database.prepare('SELECT id, name, bio, created_at FROM profiles WHERE subject = ?').bind(sub).first();}
 return p;
}
function toEntry(r,owner=false){
 const entry={id:r.id,ownerId:r.owner_id,scene:r.scene,note:r.note,context:r.context,wineName:r.wine_name,vintage:r.vintage,stage:r.stage,visibility:r.visibility,createdAt:r.created_at,updatedAt:r.updated_at,authorName:r.author_name,commentCount:r.comment_count||0,isOwner:owner};
 if(owner){try{entry.conversation=JSON.parse(r.conversation||'[]');}catch{entry.conversation=[];}entry.seconds=r.seconds||0;}
 return entry;
}
function entryInput(b){
 const note=textField(b.note,1600,'알아차린 이야기',true);
 const context=textField(b.context??'',160,'장면');
 const wineName=b.wineName===undefined?undefined:textField(b.wineName,160,'와인 이름');
 const vintage=b.vintage===undefined?undefined:textField(b.vintage,4,'빈티지').toUpperCase();
 if(vintage&&!/^(?:[0-9]{4}|NV)$/.test(vintage))throw new ApiError(400,'빈티지는 네 자리 연도 또는 NV로 적어주세요. 모르면 비워둬도 괜찮아요.');
 const scene=wineName||vintage?'wine':['wine','daily'].includes(b.scene)?b.scene:'wine';
 const stage=['color','aroma','texture','finish'].includes(b.stage)?b.stage:'finish';
 const seconds=Number(b.seconds||0);if(!Number.isFinite(seconds)||seconds<0||seconds>86400)throw new ApiError(400,'연습 시간을 확인해주세요.');
 const conversation=b.conversation??[];if(!Array.isArray(conversation)||conversation.length>8)throw new ApiError(400,'돌아보기 내용을 확인해주세요.');
 const messages=conversation.map(m=>{if(!m||!['guide','you'].includes(m.role))throw new ApiError(400,'돌아보기 내용을 확인해주세요.');return{role:m.role,text:textField(m.text,1600,'돌아보기 내용')};});
 return {note,context,wineName,vintage,scene,stage,seconds:Math.round(seconds),conversation:JSON.stringify(messages)};
}
async function accessibleEntry(database,id,p){
 const r=await database.prepare('SELECT '+publicColumns+', e.conversation, e.seconds FROM entries e JOIN profiles p ON p.id=e.owner_id WHERE e.id=? AND (e.visibility=\'public\' OR e.owner_id=?)').bind(id,p?.id||'').first();
 if(!r)throw new ApiError(404,'공개된 기록이 없거나 나만 보는 기록이에요.');return r;
}
export async function handleApi(request,env){
 try {
  const url=new URL(request.url),path=url.pathname,method=request.method;
  if(!['GET','PUT','POST','PATCH','DELETE'].includes(method))throw new ApiError(405,'지원하지 않는 요청이에요.');
  if(method!=='GET')verifyWrite(request);
  const sub=subject(request);
  if(path==='/api/me'&&method==='GET'){
   if(!sub)return json({authenticated:false,profile:null});
   return json({authenticated:true,profile:await profileFor(db(env),sub)});
  }
  const database=db(env);
  if(path==='/api/account/export'&&method==='GET'){
   const owner=await profileFor(database,requireSubject(request));
   if(!owner)return json({schemaVersion:1,exportedAt:new Date().toISOString(),profile:null,entries:[],comments:[]});
   const rows=await database.prepare('SELECT '+publicColumns+',e.conversation,e.seconds FROM entries e JOIN profiles p ON p.id=e.owner_id WHERE e.owner_id=? ORDER BY e.created_at DESC,e.id DESC').bind(owner.id).all();
   const comments=await database.prepare('SELECT id,entry_id AS entryId,body,created_at AS createdAt FROM comments WHERE author_id=? ORDER BY created_at,id').bind(owner.id).all();
   return json({schemaVersion:1,exportedAt:new Date().toISOString(),profile:owner,entries:rows.results.map(r=>toEntry(r,true)),comments:comments.results});
  }
  if(path==='/api/account'&&method==='DELETE'){
   const identity=requireSubject(request),b=await body(request);
   if(b.confirm!=='DELETE')throw new ApiError(400,'계정 삭제 안내를 확인하고 다시 선택해주세요.');
   const owner=await profileFor(database,identity);
   if(owner)await database.batch([
    database.prepare('DELETE FROM comments WHERE author_id=?').bind(owner.id),
    database.prepare('DELETE FROM entries WHERE owner_id=?').bind(owner.id),
    database.prepare('DELETE FROM profiles WHERE id=?').bind(owner.id),
   ]);
   return json({deleted:true});
  }
  if(path==='/api/profile'&&method==='PUT'){
   const owner=await profileFor(database,requireSubject(request),true),b=await body(request);
   const name=textField(b.name,32,'닉네임',true),bio=textField(b.bio??'',240,'소개');
   await database.prepare('UPDATE profiles SET name=?, bio=? WHERE id=?').bind(name,bio,owner.id).run();
   return json({profile:{...owner,name,bio}});
  }
  if(path==='/api/feed'&&method==='GET'){
   const viewer=sub?await profileFor(database,sub):null;
   const rows=await database.prepare('SELECT '+publicColumns+', (SELECT count(*) FROM comments c WHERE c.entry_id=e.id) AS comment_count FROM entries e JOIN profiles p ON p.id=e.owner_id WHERE e.visibility=\'public\' ORDER BY e.created_at DESC, e.id DESC LIMIT 21 OFFSET ?').bind(offsetParam(url)).all();
   return json({items:rows.results.slice(0,20).map(r=>toEntry(r,r.owner_id===viewer?.id)),hasMore:rows.results.length>20});
  }
  if(path==='/api/entries'&&method==='GET'){
   const owner=await profileFor(database,requireSubject(request));
   if(!owner)return json({items:[],hasMore:false});
   const rows=await database.prepare('SELECT '+publicColumns+', e.conversation, e.seconds, (SELECT count(*) FROM comments c WHERE c.entry_id=e.id) AS comment_count FROM entries e JOIN profiles p ON p.id=e.owner_id WHERE e.owner_id=? ORDER BY e.created_at DESC, e.id DESC LIMIT 21 OFFSET ?').bind(owner.id,offsetParam(url)).all();
   return json({items:rows.results.slice(0,20).map(r=>toEntry(r,true)),hasMore:rows.results.length>20});
  }
  const profileMatch=path.match(/^\/api\/profiles\/([^/]+)$/);
  if(profileMatch&&method==='GET'){
   const id=validId(profileMatch[1]),p=await database.prepare('SELECT id,name,bio,created_at FROM profiles WHERE id=?').bind(id).first();
   if(!p)throw new ApiError(404,'프로필을 찾지 못했어요.');
   const rows=await database.prepare('SELECT '+publicColumns+', (SELECT count(*) FROM comments c WHERE c.entry_id=e.id) AS comment_count FROM entries e JOIN profiles p ON p.id=e.owner_id WHERE e.owner_id=? AND e.visibility=\'public\' ORDER BY e.created_at DESC,e.id DESC LIMIT 21 OFFSET ?').bind(id,offsetParam(url)).all();
   return json({profile:p,items:rows.results.slice(0,20).map(r=>toEntry(r)),hasMore:rows.results.length>20});
  }
  const entryMatch=path.match(/^\/api\/entries\/([^/]+)(?:\/(visibility|comments))?$/);
  if(entryMatch){
   const id=validId(entryMatch[1]),operation=entryMatch[2];
   if(!operation&&method==='GET'){
    const viewer=sub?await profileFor(database,sub):null,r=await accessibleEntry(database,id,viewer);
    const list=await database.prepare('SELECT c.id,c.body,c.created_at,c.author_id,p.name AS author_name FROM comments c JOIN profiles p ON p.id=c.author_id WHERE c.entry_id=? ORDER BY c.created_at ASC,c.id ASC LIMIT 51 OFFSET ?').bind(id,offsetParam(url)).all();
    return json({entry:toEntry(r,r.owner_id===viewer?.id),comments:list.results.slice(0,50).map(c=>({id:c.id,body:c.body,createdAt:c.created_at,authorId:c.author_id,authorName:c.author_name,canDelete:c.author_id===viewer?.id||r.owner_id===viewer?.id})),hasMoreComments:list.results.length>50});
   }
   const owner=await profileFor(database,requireSubject(request),true);
   if(!operation&&method==='PUT'){
    const b=entryInput(await body(request)),now=new Date().toISOString();
    const r=await database.prepare('INSERT INTO entries (id,owner_id,scene,note,context,wine_name,vintage,stage,conversation,seconds,visibility,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,\'private\',?,?) ON CONFLICT(id) DO UPDATE SET scene=excluded.scene,note=excluded.note,context=excluded.context,wine_name=coalesce(?,entries.wine_name),vintage=coalesce(?,entries.vintage),stage=excluded.stage,conversation=excluded.conversation,seconds=excluded.seconds,visibility=\'private\',updated_at=excluded.updated_at WHERE entries.owner_id=excluded.owner_id').bind(id,owner.id,b.scene,b.note,b.context,b.wineName??'',b.vintage??'',b.stage,b.conversation,b.seconds,now,now,b.wineName??null,b.vintage??null).run();
    if(!r.meta.changes)throw new ApiError(404,'저장할 기록을 찾지 못했어요.');
    return json({entry:toEntry(await accessibleEntry(database,id,owner),true)});
   }
   if(operation==='visibility'&&method==='PATCH'){
    const b=await body(request);if(!['private','public'].includes(b.visibility))throw new ApiError(400,'공개 범위를 확인해주세요.');
    const r=await database.prepare('UPDATE entries SET visibility=?,updated_at=? WHERE id=? AND owner_id=?').bind(b.visibility,new Date().toISOString(),id,owner.id).run();
    if(!r.meta.changes)throw new ApiError(404,'기록을 찾지 못했어요.');
    return json({visibility:b.visibility});
   }
   if(!operation&&method==='DELETE'){
    const r=await database.prepare('DELETE FROM entries WHERE id=? AND owner_id=?').bind(id,owner.id).run();
    if(!r.meta.changes)throw new ApiError(404,'기록을 찾지 못했어요.');return json({deleted:true});
   }
   if(operation==='comments'&&method==='POST'){
    const b=await body(request),commentId=validId(b.id),value=textField(b.body,1000,'댓글',true);
    const existing=await database.prepare('SELECT id FROM comments WHERE id=? AND author_id=? AND entry_id=?').bind(commentId,owner.id,id).first();
    if(existing)return json({id:commentId});
    const recent=await database.prepare('SELECT count(*) AS n FROM comments WHERE author_id=? AND created_at>?').bind(owner.id,new Date(Date.now()-60000).toISOString()).first();
    if(recent.n>=6)throw new ApiError(429,'잠시 쉬었다가 이야기를 이어가주세요.');
    const r=await database.prepare('INSERT INTO comments (id,entry_id,author_id,body,created_at) SELECT ?,id,?,?,? FROM entries WHERE id=? AND visibility=\'public\' ON CONFLICT(id) DO NOTHING').bind(commentId,owner.id,value,new Date().toISOString(),id).run();
    if(!r.meta.changes)throw new ApiError(404,'댓글을 남길 공개 기록이 없어요.');return json({id:commentId},201);
   }
  }
  const commentMatch=path.match(/^\/api\/comments\/([^/]+)$/);
  if(commentMatch&&method==='DELETE'){
   const owner=await profileFor(database,requireSubject(request));if(!owner)throw new ApiError(404,'댓글을 찾지 못했어요.');
   const r=await database.prepare('DELETE FROM comments WHERE id=? AND (author_id=? OR entry_id IN (SELECT id FROM entries WHERE owner_id=?))').bind(validId(commentMatch[1]),owner.id,owner.id).run();
   if(!r.meta.changes)throw new ApiError(404,'댓글을 찾지 못했어요.');return json({deleted:true});
  }
  throw new ApiError(404,'요청한 페이지를 찾지 못했어요.');
 }catch(error){
  if(error instanceof ApiError)return json({error:error.message},error.status);
  console.error('maeum-api-failure',error?.name);
  return json({error:'지금 저장소에 연결하지 못했어요. 작성한 내용은 그대로 두고 잠시 후 다시 시도해주세요.'},503);
 }
}
