const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fields={wineName:160,vintage:4,context:160,note:1600};
export function normalizeRecord(value,{draft=false}={}){
 if(!value||!UUID.test(value.id)||!Number.isFinite(Date.parse(value.date)))throw Error('기록 형식을 확인해주세요.');
 const r={id:value.id,date:value.date,updatedAt:value.updatedAt||value.date,stage:['color','aroma','texture','finish'].includes(value.stage)?value.stage:'finish',seconds:Math.max(0,Math.min(86400,Number(value.seconds)||0))};
 for(const [key,max] of Object.entries(fields)){if(value[key]!==undefined&&typeof value[key]!=='string')throw Error('기록 형식을 확인해주세요.');r[key]=(value[key]||'').slice(0,max);}
 r.vintage=r.vintage.trim().toUpperCase();
 if(!draft&&r.vintage&&!/^(?:\d{4}|NV)$/.test(r.vintage))throw Error('빈티지는 네 자리 연도 또는 NV로 적어주세요.');
 if(!draft&&!r.note.trim())throw Error('지금 알아차린 것을 한 줄 남겨주세요.');
 r.conversation=Array.isArray(value.conversation)?value.conversation.slice(0,8).filter(m=>m&&['you','guide'].includes(m.role)&&typeof m.text==='string').map(m=>({role:m.role,text:m.text.slice(0,1600)})):[];
 if(value.photoPath&&!/^[0-9a-f-]{36}\/[0-9a-f-]{36}$/i.test(value.photoPath))throw Error('사진 정보를 확인해주세요.');
 r.photoPath=value.photoPath||null;r.commentsEnabled=value.commentsEnabled!==false;r.featured=value.featured===true;
 return r;
}
function decode(raw){
 if(raw===null)return {version:1,entries:[],draft:null};
 let v;try{v=JSON.parse(raw);}catch{throw Error('기록을 읽지 못했어요. 기존 데이터를 보존했어요.');}
 if(v?.version!==1||!Array.isArray(v.entries))throw Error('지원하지 않는 기록 형식이에요.');
 return {version:1,entries:v.entries.map(r=>normalizeRecord(r)),draft:v.draft?normalizeRecord(v.draft,{draft:true}):null};
}
export function createJournal(adapter){
 let queue=Promise.resolve();
 const serial=fn=>{const p=queue.then(fn);queue=p.catch(()=>{});return p;};
 const read=async()=>decode(await adapter.read());
 const change=fn=>serial(async()=>{const state=await read();const result=fn(state);await adapter.write(JSON.stringify(state));return result;});
 return {
  list:()=>serial(async()=>[...(await read()).entries].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date))),
  draft:()=>serial(async()=>(await read()).draft),
  storeDraft:r=>change(s=>{s.draft=r?normalizeRecord(r,{draft:true}):null;}),
  save:r=>change(s=>{const next=normalizeRecord({...r,updatedAt:new Date().toISOString()});const i=s.entries.findIndex(e=>e.id===next.id);if(i<0)s.entries.push(next);else s.entries[i]=next;if(s.draft?.id===next.id)s.draft=null;return next;}),
  remove:id=>change(s=>{s.entries=s.entries.filter(e=>e.id!==id);if(s.draft?.id===id)s.draft=null;}),
  export:()=>serial(async()=>({app:'maeum-gyeol-mobile',exportedAt:new Date().toISOString(),...await read()})),
  import:raw=>change(s=>{const source=JSON.parse(raw);if(source.app!=='maeum-gyeol-mobile')throw Error('마음결 앱에서 내려받은 백업 파일을 선택해주세요.');const incoming=decode(JSON.stringify(source));let count=0;for(const r of incoming.entries){if(!s.entries.some(e=>e.id===r.id)){s.entries.push(r);count++;}}return count;})
 };
}
export function shareText(r){return ['마음결 · 내가 알아차린 순간',new Date(r.date).toLocaleDateString('ko-KR'),r.wineName?[r.wineName,r.vintage].filter(Boolean).join(' · '):r.vintage?'이름 미기록 · '+r.vintage:'',r.context,r.note].filter(Boolean).join('\n\n');}
