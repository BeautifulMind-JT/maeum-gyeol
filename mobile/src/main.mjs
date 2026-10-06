import {createPhotoLoader,preparePhoto} from './photos.mjs';
import {publicLink} from './social-ui.mjs';
import {newId} from './identity.mjs';
import {STAGES,TastingClock,TOTAL_SECONDS,REFLECTIONS} from './shared/tasting.mjs';
import {escapeHtml as esc} from './shared/model.mjs';
import {shareText} from './storage.mjs';
import {native,storageAdapter,createStorageAdapter,createAuthStorage,openCommunity,openExternal,shareMoment,savePhoto,speak,stopSpeech,bindLifecycle,minimize} from './runtime.mjs';
import {POLICY_URLS,crisisNoticeMarkup} from './policies.mjs';
import {createServerJournal} from './server-journal.mjs';
import {loadCloud} from './cloud.mjs';
import {captureOAuthCallback} from './oauth.mjs';
import {createCloudUI} from './cloud-ui.mjs';
import {icon,stageOf,cover,momentCard,reviewCard,stats,emptyJournal,entryImage,entryHeading,diaryRows} from './presentation.mjs';
document.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);});
const main=document.querySelector('main'),dialog=document.querySelector('dialog'),dialogContent=document.querySelector('#dialog-content');
let journal=null,cloud=null,accountUser=null,cloudError='',syncState='',authEpoch=0,authReady=Promise.resolve(),legacyError='',pendingIntent=null;
let authCallbackPending=false;
let draftDirty=false,draftGeneration=0,finishSnapshot=null,archiveRows=[],draftFailure=null;
let view='home',draft=null,record=null,clock=null,voice=true,speechError='',cueKey='',viewEpoch=0,toastTimer,draftTimer,saving=false;
const photos=createPhotoLoader(()=>cloud);
let photoUpload=null,archiveQuery='',archiveStage='',archiveLayout='grid';
const dateLabel=d=>new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric'}).format(new Date(d));
function toast(text){const el=document.querySelector('.toast');el.textContent=text;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),4200);}
const cloudUI=createCloudUI({main,native,hydrate:()=>photos.hydrate(main),shareMoment,cloud:()=>cloud,user:()=>accountUser,journal:()=>journal,legacyInfo,importLegacyGuest,importLegacyAccount,legacyError:()=>legacyError,afterLogin,startGoogle,googleLoginBlocked,record:()=>record,cloudError:()=>cloudError,syncState:()=>syncState,current:()=>view,leave,screen,popup,toast,settings,list,detail,closeDialog:()=>dialog.close(),sync:()=>syncCloud(),changeUser});
async function syncCloud({quiet=false}={}){
 if(!journal)return;const j=journal;
 try{await j.sync();if(j!==journal)return;syncState='기록은 내 계정에 보관돼요.';cloud.cleanupPhotos({includeDrafts:true}).catch(()=>{});}
 catch(error){if(j===journal)syncState='서버에 연결하지 못했어요. 다시 시도해주세요.';if(!quiet)throw error;}
}
// The safety notice marker is device state like the auth session, never a record.
const safetyStore=createStorageAdapter('safety-v1');
async function safetySeen(){try{return JSON.parse(await safetyStore.read()||'{}').crisisNotice===true;}catch{return true;}}
async function markSafetySeen(){try{await safetyStore.write(JSON.stringify({crisisNotice:true}));}catch{}}
function showSafetyNotice(){popup('잠시, 안전 안내를 전해요.',crisisNoticeMarkup(),'<button class="primary" data-action="safety-ack">확인했어요</button>');}
async function legacyInfo(){try{const raw=await storageAdapter.read(),old=raw?JSON.parse(raw):null;return {count:old?.entries?.filter(r=>!r.deleted).length||0,draft:Boolean(old?.draft),exists:Boolean(old?.entries?.length||old?.draft)};}catch{return {count:0,draft:false,exists:false};}}
async function importLegacyGuest(){const j=journal,user=accountUser;if(!j)throw Error('로그인해주세요.');await j.migrate(storageAdapter,{owner:user.id});if(j!==journal)throw Error('계정이 바뀌었어요.');}
async function importLegacyAccount(){const j=journal,user=accountUser;if(!j)return;const adapter=createStorageAdapter('account-'+cloud.scope+'-'+user.id);try{await j.migrate(adapter,{owner:user.id,account:true});if(j===journal)legacyError='';}catch(e){if(j===journal)legacyError=e.message;}}
function changeUser(user){
 if(accountUser?.id===user?.id)return authReady;
 // Clear the previous account's UI before any network request can resolve.
 const t=++authEpoch;pause();clearTimeout(draftTimer);photos.release();accountUser=user;clock=null;record=null;draft=null;archiveRows=[];draftDirty=false;finishSnapshot=null;draftFailure=null;dialog.close();
 journal=user?createServerJournal(cloud.remote(user.id)):null;legacyError='';screen('home');main.innerHTML='<p class="loading">마음결을 열고 있어요.</p>';
 authReady=(async()=>{if(user){await cloud.ensureProfile().catch(()=>{});if(t!==authEpoch)return;await importLegacyAccount();}if(t!==authEpoch)return;await home();})();return authReady;
}
async function requireAccount(intent){if(accountUser&&journal)return true;pendingIntent=intent;await cloudUI.account();return false;}
async function afterLogin(){await authReady;const intent=pendingIntent;pendingIntent=null;if(intent?.kind==='editor')return editor(intent.value);if(intent?.kind==='journal')return list();return cloudUI.account();}
function googleLoginBlocked(){return Boolean(pendingIntent?.value||clock?.elapsed>0||draftDirty||finishSnapshot);}
async function startGoogle(){if(native||googleLoginBlocked())throw Error('지금 남기던 순간을 이어가려면 이메일로 로그인해주세요.');const epoch=viewEpoch,user=accountUser;await leave();await cloud.google.start(pendingIntent?.kind||'account',()=>epoch===viewEpoch&&user===accountUser&&!googleLoginBlocked());}
function screen(name){photos.release();if(['home','journal','settings','account','entry','editor','practice'].includes(name))history.replaceState(null,'','#'+(['entry','editor'].includes(name)?'journal':name==='practice'?'home':name));view=name;viewEpoch++;document.body.dataset.view=name;document.body.classList.toggle('practicing',name==='practice');const active=['entry','editor'].includes(name)?'journal':['public-entry','profile','people','notifications'].includes(name)?'together':name==='account'?'settings':name;document.querySelectorAll('.main-nav button,.header-nav button').forEach(b=>b.setAttribute('aria-current',b.dataset.action===active?'page':'false'));document.querySelector('.header-back').hidden=!['entry','public-entry','editor'].includes(name);document.querySelector('.main-nav [data-icon=home]').innerHTML=icon(active==='home'?'home-fill':'home');main.focus({preventScroll:true});window.scrollTo(0,0);return viewEpoch;}
function popup(title,body,actions){dialogContent.innerHTML=`<h2>${title}</h2>${body}<div class="dialog-actions">${actions}<button class="quiet" data-action="close">돌아가기</button></div>`;if(!dialog.open)dialog.showModal();}
function pause(){if(clock?.running){clock.pause(performance.now());stopSpeech();if(view==='practice')updatePlayer();}}
async function leave(){if(saving)throw Error('저장이 끝날 때까지 잠시 기다려주세요.');if(photoUpload)await photoUpload;pause();if(finishSnapshot)throw Error('저장 결과 확인을 먼저 눌러주세요.');if(view==='editor')await flushDraft();}
async function home(){await leave();const epoch=screen('home');let pending=null,entries=[],loadError='';const j=journal;if(j){try{[pending,entries]=await Promise.all([j.reloadDraft(),j.list()]);}catch(e){loadError='기록을 불러오지 못했어요. 연결을 확인해주세요.';}}if(epoch!==viewEpoch||j!==journal)return;draft=pending;
 const resume=clock&&!clock.snapshot().done&&clock.elapsed>0;
 main.innerHTML=`<section class="home">
 <div class="summer-hero">
  <img class="hero-art" src="./summer-hero.webp" alt="Stay a little. 햇빛 아래 한 잔에 머무는 여름" fetchpriority="high">
  <h1 class="sr-only">오늘의 마음챙김</h1>
  <div class="hero-copy"><p class="hero-eyebrow">A LIFE, NOTICED</p><h2>순간을 모으고,<br>나를 발견해요.</h2><p class="hero-description">한 잔의 감각부터 오늘의 마음까지.<br>잠시 머문 순간이 나만의 서재가 되도록.</p></div>
  <button class="primary hero-start" data-action="${resume?'resume-session':'start'}">${resume?'멈춘 연습 이어하기':'3분 마음챙김 시작'}</button>
 </div>
 <div class="home-body"><div class="home-main">
  ${draft?'<button class="draft-link" data-action="restore-draft">작성하던 순간 이어서 남기기 '+icon('arrow')+'</button>':''}
  <section class="recent-moments"><div class="section-title"><div><p class="eyebrow">YOUR RECENT MOMENTS</p><h2>최근에 머문 순간</h2></div><button class="quiet" data-action="journal">모두 보기 ${icon('arrow')}</button></div>
  ${loadError?'<div class="load-error"><p>'+loadError+'</p><button class="quiet" data-action="home">다시 불러오기</button></div>':entries.length?'<div class="moment-grid">'+entries.slice(0,5).map(momentCard).join('')+'</div>':emptyJournal()}</section>
  <section class="home-community" aria-labelledby="home-community-title"><div class="section-title"><h2 id="home-community-title">함께 읽는 순간</h2><button class="quiet" data-action="together">모두 보기 ${icon('arrow')}</button></div><div class="home-feed-layout"><div id="home-feed" aria-live="polite"><p class="hint">공개된 순간을 불러오고 있어요.</p></div><aside class="home-aside"><p class="eyebrow">MAKE IT YOURS</p><h3>오늘의 한 줄을<br>남겨볼까요?</h3><p>잘 쓴 문장보다,<br>지금의 나에게 솔직한 기록.</p><button class="secondary" data-action="write">${icon('plus')} 순간 기록하기</button><p class="aside-footnote">${icon('lock')} 먼저 나만 보는 기록으로 저장돼요.</p></aside></div></section>
 </div>
</div></section>`;
 photos.hydrate(main);loadHomeFeed(epoch);
}
async function loadHomeFeed(epoch){
 const target=main.querySelector('#home-feed');if(!target||view!=='home'||epoch!==viewEpoch)return;
 if(!cloud){target.innerHTML='<p class="hint">각자의 알아차림을 읽고, 내 경험을 나눠보세요.</p><button class="quiet" data-action="together">공개된 순간 만나기 '+icon('arrow')+'</button>';return;}
 try{const rows=await cloud.feed();if(view!=='home'||epoch!==viewEpoch||!target.isConnected)return;target.innerHTML=rows.length?rows.slice(0,3).map(reviewCard).join(''):'<div class="home-feed-empty"><span class="empty-icon">'+icon('chat')+'</span><h3>첫 이야기를 기다리고 있어요.</h3><p>나의 기록에서 함께 나누고 싶은 순간을 골라 공개해보세요.</p><button class="quiet" data-action="journal">나의 기록 보기 '+icon('arrow')+'</button></div>';photos.hydrate(target);}
 catch{if(view==='home'&&epoch===viewEpoch&&target.isConnected)target.innerHTML='<p class="hint">공개된 순간에 연결하지 못했어요. 연결을 확인하고 다시 시도해주세요.</p><button class="quiet" data-action="together">다시 불러오기 '+icon('arrow')+'</button>';}
}
async function start(){
 if(draft?.note||draft?.wineName||draft?.vintage||draft?.context||draft?.conversation?.length){popup('작성하던 기록이 있어요.','<p>기록을 먼저 마무리하거나, 임시 내용을 지우고 새 연습을 시작할 수 있어요.</p>','<button class="primary" data-action="restore-draft">이어서 기록하기</button><button class="danger" data-action="discard-and-start">임시 기록 지우고 시작</button>');return;}
 await startFresh();
}
async function startFresh(){dialog.close();clock=new TastingClock();cueKey='';speechError='';draft=freshDraft();clock.resume(performance.now());player();tick();}
function freshDraft(){return {id:newId(),date:new Date().toISOString(),wineName:'',vintage:'',context:'',note:'',stage:'finish',seconds:0,conversation:[]};}
function player(){screen('practice');const s=clock.snapshot(),stage=STAGES[s.stage];
 main.innerHTML=`<section class="player"><div class="section-line"><p class="eyebrow">3분 마음챙김</p><button class="quiet" data-action="finish-early">마치기</button></div><ol class="stage-track">${STAGES.map((v,i)=>`<li ${i===s.stage?'aria-current="step"':''}><span>0${i+1}</span>${v.label}</li>`).join('')}</ol><p class="eyebrow current-stage">${stage.english}</p><h1>${stage.title}</h1><p class="cue" aria-live="polite">${stage.cues[s.cueIndex].text}</p><p class="rest">${stage.rest}</p><div class="player-meta"><span id="speech-status">${voice?'음성으로 따라가기':'화면으로 따라가기'}</span><time id="remaining"></time></div><progress max="180" value="${clock.elapsed}" aria-label="마음챙김 진행률"></progress><button class="primary" data-action="pause" id="pause-control"></button><div class="player-bottom"><button class="quiet" data-action="voice" id="voice-control"></button><button class="quiet" data-action="next-stage">${s.stage===3?'기록하기':'다음 연습 →'}</button></div><p class="hint" id="speech-error" role="status"></p><p class="hint center">화면을 떠나면 연습이 잠시 멈춰요.</p></section>`;
 updatePlayer();
}
function updatePlayer(){if(view!=='practice')return;const s=clock.snapshot();document.querySelector('#remaining').textContent=Math.floor(s.remaining/60)+':'+String(s.remaining%60).padStart(2,'0');document.querySelector('progress').value=clock.elapsed;document.querySelector('#pause-control').textContent=clock.running?'잠시 멈추기':'이어가기';const voiceControl=document.querySelector('#voice-control');voiceControl.textContent=voice?'음성 켜짐':'음성 꺼짐';voiceControl.setAttribute('aria-pressed',String(voice));document.querySelector('#speech-status').textContent=voice&&!speechError?'음성으로 따라가기':'화면으로 따라가기';document.querySelector('#speech-error').textContent=speechError;}
function tick(){if(view!=='practice'||!clock?.running)return;const before=clock.snapshot();const s=clock.tick(performance.now());if(s.done){finish().catch(e=>toast(e.message));return;}if(before.stage!==s.stage)player();const key=s.stage+':'+s.cueIndex;if(key!==cueKey){cueKey=key;const text=STAGES[s.stage].cues[s.cueIndex].text;document.querySelector('.cue').textContent=text;if(voice)speak(text).catch(e=>{speechError=e.message;updatePlayer();});}updatePlayer();}
setInterval(tick,200);
async function finish(){pause();const value={...(draft||freshDraft()),seconds:Math.round(clock?.activeSeconds||0)};clock=null;await editor(value);}
function reflectionAnswer(question){const messages=draft.conversation||[];const index=messages.findIndex(m=>m.role==='guide'&&m.text===question);return index>=0&&messages[index+1]?.role==='you'?messages[index+1].text:'';}
function photoField(){return `<section id="photo-field" class="photo-field"><div class="section-title"><h2>이 순간의 사진 <small>선택</small></h2>${draft.photoPath?'<button type="button" class="quiet" data-action="photo-remove">사진 빼기</button>':''}</div>${draft.photoPath?'<div class="photo-preview"><img data-photo="'+esc(draft.photoPath)+'" src="./summer-still.webp" alt="이 순간의 사진"></div>':''}${accountUser?'<label class="photo-picker"><span>'+icon('plus')+' '+(draft.photoPath?'다른 사진 고르기':'와인 라벨이나 지금의 풍경')+'</span><input type="file" id="photo-file" accept="image/jpeg,image/png,image/webp"></label><p class="hint" id="photo-status">사진은 연결된 상태에서 계정에 보관돼요. 공개하기 전에는 나만 볼 수 있어요.</p>':'<p class="hint">로그인하면 사진도 함께 보관할 수 있어요.</p>'}</section>`;}
async function attachPhoto(file){
 const owner=accountUser?.id,j=journal,id=draft?.id;if(!owner||!id)return;captureDraft();
 const status=document.querySelector('#photo-status');if(status)status.textContent='사진을 보관하고 있어요…';
 try{const prepared=await preparePhoto(file);if(owner!==accountUser?.id)throw Error('계정이 바뀌었어요. 다시 선택해주세요.');const path=await cloud.uploadPhoto(prepared);
  if(j!==journal||draft?.id!==id||view!=='editor')return;const previous=draft.photoPath;draft.photoPath=path;draftDirty=true;draftGeneration++;await flushDraft();if(previous)cloud.releasePhoto(previous).catch(()=>{});document.querySelector('#photo-field').outerHTML=photoField();photos.hydrate(main);
 }catch(error){if(status?.isConnected)status.textContent='사진을 보관하지 못했어요. 다시 선택해주세요.';throw error;}
}
function editorMarkup(){const stage=STAGES.find(s=>s.id===draft.stage)||STAGES[3];return `<section class="editor"><p class="eyebrow">MY MINDFUL MOMENT</p><h1>이 순간을 기록하기.</h1><p class="lead">평가보다 알아차림. 떠오른 만큼 남겨요.</p><form id="record-form">${photoField()}<label class="field"><span>어떤 순간이었나요? <small>선택</small></span><input name="context" maxlength="160" value="${esc(draft.context)}" placeholder="퇴근 후 창가에서 잠깐"></label><fieldset class="wine-fields"><legend>함께한 와인 <small>선택</small></legend><div class="wine-inputs"><label class="field"><span>와인 이름</span><input name="wineName" maxlength="160" value="${esc(draft.wineName)}" placeholder="생산자와 와인 이름"></label><label class="field"><span>빈티지</span><input name="vintage" maxlength="4" value="${esc(draft.vintage)}" placeholder="연도 / NV" autocapitalize="characters"></label></div><p class="hint">모르는 정보는 비워둬도 괜찮아요.</p></fieldset><fieldset><legend>기억에 남는 연습</legend><div class="stage-choices">${STAGES.map(s=>`<label><input type="radio" name="stage" value="${s.id}" ${draft.stage===s.id?'checked':''}><span>${s.label}</span></label>`).join('')}</div></fieldset><label class="field"><span id="note-question">${stage.question}</span><textarea name="note" maxlength="1600" required placeholder="다른 생각을 하던 나를 알아차렸고, 잔의 온도로 주의를 돌려봤어요.">${esc(draft.note)}</textarea></label><label class="check-field"><input type="checkbox" name="commentsEnabled" ${draft.commentsEnabled!==false?'checked':''}> 공개했을 때 댓글 받기</label><details class="reflection" ${draft.conversation?.length?'open':''}><summary>조금 더 돌아보기</summary><p class="hint">준비된 질문을 따라 내 경험을 살펴봐요.</p>${REFLECTIONS.slice(0,2).map((q,i)=>`<label class="field"><span>${q}</span><textarea data-reflection="${i}" maxlength="1600" placeholder="떠오르는 만큼 적어보세요.">${esc(reflectionAnswer(q))}</textarea></label>`).join('')}</details><button class="primary" type="submit">${draft.visibility==='public'?'공개된 기록 수정':'나만 보는 기록으로 저장'}</button><p class="hint center" id="draft-status" role="status">서버에 초안을 보관하고 있어요…</p><div id="draft-recovery" class="draft-recovery" hidden><button type="button" class="secondary" data-action="retry-draft">다시 저장</button><button type="button" class="quiet" data-action="copy-draft">작성한 내용 복사</button><button type="button" class="quiet" data-action="reload-draft-preview">서버의 초안 다시 열기</button></div></form></section>`;}
async function editor(value){
 // Bind the account and view before the first await, including the account check.
 const j=journal,epoch=viewEpoch;
 if(!await requireAccount({kind:'editor',value:structuredClone(value||freshDraft())}))return;
 if(j!==journal||epoch!==viewEpoch)return;
 await leave();if(j!==journal||epoch!==viewEpoch)return;
 const pending=await j.reloadDraft();if(j!==journal||epoch!==viewEpoch)return;
 if(pending&&value&&pending.id!==value.id){popup('서버에서 작성하던 글이 있어요.','<p>작성 중인 글을 먼저 마무리해주세요. 기존 내용은 그대로 보관돼요.</p>','<button class="primary" data-action="restore-draft">작성하던 글 이어보기</button>');return;}
 screen('editor');draft=structuredClone(value||pending||freshDraft());draft.entryRevision=Number(draft.entryRevision??draft.revision)||0;draftDirty=true;draftGeneration++;draftFailure=null;finishSnapshot=null;main.innerHTML=editorMarkup();photos.hydrate(main);await flushDraft();
}
function captureDraft(){if(view!=='editor')return;const form=document.querySelector('#record-form');for(const key of ['context','wineName','vintage','note'])draft[key]=form.elements[key].value;draft.stage=form.elements.stage.value;draft.commentsEnabled=form.elements.commentsEnabled.checked;draft.conversation=[];form.querySelectorAll('[data-reflection]').forEach(el=>{if(el.value.trim())draft.conversation.push({role:'guide',text:REFLECTIONS[Number(el.dataset.reflection)]},{role:'you',text:el.value});});}
function draftStatus(message,error=null){const el=main.querySelector('#draft-status');if(!el)return;el.textContent=message;el.dataset.state=error?'error':'saved';const recovery=main.querySelector('#draft-recovery');recovery.hidden=!error;recovery.querySelector('[data-action="retry-draft"]').textContent=finishSnapshot?'저장 결과 확인':'다시 저장';draftFailure=error;}
async function flushDraft(){
 clearTimeout(draftTimer);if(view!=='editor'||!draft||!journal||finishSnapshot||!draftDirty)return;captureDraft();const j=journal,id=draft.id,g=draftGeneration,epoch=viewEpoch;
 draftStatus('서버에 초안을 보관하고 있어요…');
 try{await j.storeDraft(structuredClone(draft));if(j!==journal||view!=='editor'||epoch!==viewEpoch||draft?.id!==id)return;if(g===draftGeneration){draftDirty=false;draftStatus('초안이 내 계정에 비공개로 보관됐어요.');}}
 catch(e){if(j===journal&&view==='editor'&&epoch===viewEpoch){draftDirty=true;draftStatus(e.code?.includes('CONFLICT')?e.message:'서버 저장을 확인하지 못했어요. 연결 후 다시 저장해주세요. 화면을 닫으면 미전송 내용이 사라질 수 있어요.',e);}throw e;}
}
function freezeEditor(frozen){main.querySelectorAll('#record-form input,#record-form textarea,#record-form summary,#record-form [data-action="photo-remove"]').forEach(el=>{el.disabled=frozen;});}
async function save(){
 if(saving)return;saving=true;const j=journal,epoch=viewEpoch,button=document.querySelector('#record-form button[type="submit"]');button.disabled=true;
 try{if(photoUpload)await photoUpload;if(!finishSnapshot){freezeEditor(true);await flushDraft();finishSnapshot=structuredClone(draft);freezeEditor(true);}const result=await j.finish(finishSnapshot);if(j!==journal||epoch!==viewEpoch)return;
  finishSnapshot=null;draft=null;draftDirty=false;record=result;toast('내 계정에 기록을 저장했어요.');await detail(result,false);cloud.cleanupPhotos({includeDrafts:true}).catch(()=>{});
 }catch(e){if(j===journal&&epoch===viewEpoch){if(!finishSnapshot||!j.hasPending()||e.code?.includes('CONFLICT')||(e.status>=400&&e.status<500)){finishSnapshot=null;freezeEditor(false);}draftStatus(finishSnapshot?'저장 결과를 확인하지 못했어요. 다시 눌러 결과를 확인해주세요.':e.message,e);}throw e;
 }finally{saving=false;if(button?.isConnected)button.disabled=false;}
}
function archiveMarkup(entries){
 const query=archiveQuery.trim().toLocaleLowerCase();const filtered=entries.filter(r=>(!archiveStage||r.stage===archiveStage)&&(!query||[r.wineName,r.vintage,r.context,r.note].join(' ').toLocaleLowerCase().includes(query)));
 if(!entries.length)return emptyJournal();
 if(!filtered.length)return '<div class="empty"><h2>찾는 순간이 아직 없어요.</h2><p>검색어나 연습 종류를 바꿔보세요.</p></div>';
 if(archiveLayout==='grid')return '<div class="moment-grid">'+filtered.map(momentCard).join('')+'</div>';
 return diaryRows(filtered);
}
async function refreshArchive(){if(view!=='journal')return;const t=viewEpoch,rows=archiveRows;if(t!==viewEpoch)return;document.querySelector('#archive-results').innerHTML=archiveMarkup(rows);photos.hydrate(main);}
async function list(refresh=true){if(!await requireAccount({kind:'journal'}))return;await leave();const epoch=screen('journal');main.innerHTML='<p class="loading">나의 순간을 불러오고 있어요.</p>';const j=journal;let entries;try{entries=await j.list();}catch(e){if(epoch===viewEpoch)main.innerHTML='<section class="empty"><h1>기록을 불러오지 못했어요.</h1><p>연결을 확인하고 다시 시도해주세요.</p><button class="primary" data-action="journal">다시 불러오기</button></section>';return;}if(epoch!==viewEpoch||j!==journal)return;archiveRows=entries;
 main.innerHTML=`<section class="journal"><div class="page-heading"><div><p class="eyebrow">MY MOMENTS, COLLECTED</p><h1>내 서재</h1></div><button class="small-button" data-action="write">${icon('plus')} 기록</button></div>${stats(entries)}<div class="archive-intro"><p class="lead">내가 머물렀던 순간들.</p>${accountUser?'<button class="quiet" data-social-action="profile" data-id="'+accountUser.id+'">공개 프로필 '+icon('arrow')+'</button>':''}</div><div class="archive-toolbar"><label class="archive-search"><span class="sr-only">기록 검색</span><input id="archive-query" value="${esc(archiveQuery)}" placeholder="순간, 와인, 한 문장 검색"></label><label><span class="sr-only">마음챙김 연습</span><select id="archive-stage"><option value="">모든 연습</option>${STAGES.map(s=>'<option value="'+s.id+'" '+(s.id===archiveStage?'selected':'')+'>'+esc(s.label)+'</option>').join('')}</select></label><div class="view-switch" aria-label="서재 보기"><button data-action="archive-grid" aria-pressed="${archiveLayout==='grid'}">서재</button><button data-action="archive-diary" aria-pressed="${archiveLayout==='diary'}">다이어리</button></div></div><div id="archive-results">${archiveMarkup(entries)}</div><p class="archive-caption">${icon('lock')} 공개한 순간을 제외한 기록은 나만 볼 수 있어요.</p>${accountUser?'<p class="sync-state" role="status">'+esc(syncState)+'</p>':''}</section>`;
 photos.hydrate(main);

}
async function detail(r,shouldLeave=true){if(!r)throw Error('기록을 다시 열어주세요.');const j=journal,epoch=viewEpoch;if(shouldLeave)await leave();if(j!==journal||epoch!==viewEpoch)return;screen('entry');record=r;main.innerHTML=`<article class="record">${entryImage(r)}<div class="record-copy">${entryHeading(r)}<div class="record-meta"><time>${dateLabel(r.date)}</time><span>${esc(stageOf(r).label)}</span><span class="badge">${r.visibility==='public'?'공개':icon('lock')+' 나만 보기'}</span></div><p class="record-note">${esc(r.note)}</p>${r.conversation?.length?'<details class="reflection"><summary>나만 보는 돌아보기</summary>'+r.conversation.map(m=>'<p class="message '+m.role+'">'+esc(m.text)+'</p>').join('')+'</details>':''}<div class="record-actions"><button class="primary" data-action="share-preview">${icon('share')} 이 순간 나누기</button><button class="secondary" data-action="edit">기록 수정</button>${cloud?`<button class="secondary" data-cloud-action="${accountUser?'publish-preview':'account'}">${accountUser?(r.visibility==='public'?'나만 보기로 전환':'함께에 공개하기'):'로그인하고 계정에 보관'}</button>`:''}</div><p class="hint">돌아보기 대화는 공유 내용에 포함하지 않아요.</p>${accountUser&&r.visibility==='public'?`<div class="record-tools"><button class="quiet" data-action="pin-record">${r.featured?'대표 기록에서 빼기':'대표 기록으로 고정'}</button><button class="quiet" data-action="public-link">${icon('share')} 공개 링크 복사·공유</button><button class="quiet" data-social-action="post" data-id="${r.id}">공개된 모습 보기</button></div>`:''}${r.photoPath?'<button class="quiet" data-action="download-photo">사진 저장</button>':''}<button class="danger" data-action="delete-preview">기록 삭제</button></div></article>`;photos.hydrate(main);}

async function together(){if(cloud)return cloudUI.feed();await leave();screen('together');main.innerHTML=`<section><p class="eyebrow">SHARED MOMENTS</p><h1>각자의 순간에,<br>잠시 머물러요.</h1><p class="lead">같은 연습, 서로 다른 알아차림.<br>경험을 읽고 내 이야기를 건네보세요.</p><div class="community-card"><h2>마음결 온라인 공간</h2><p>공개된 기록을 읽고 댓글을 나눌 수 있어요. 로그인과 공개 기록 작성은 브라우저에서 이어져요.</p><button class="primary" data-action="open-community">공개된 순간 만나기 →</button></div><p class="hint">앱에 저장한 개인 기록은 자동으로 올라가지 않아요.</p></section>`;}
async function settings(){await leave();screen('settings');main.innerHTML=`<section class="settings-page"><p class="eyebrow">MY SPACE</p><h1>나의 공간</h1><div class="settings-row"><div><h2>내 계정</h2><p>${accountUser?esc(accountUser.email||'로그인됨'):'로그인하고 여러 기기에서 이어봐요.'}</p></div><button class="small-button" data-cloud-action="account">${accountUser?'계정 관리':'로그인'}</button></div><div class="settings-about"><h2>마음결</h2><p>일상의 감각에 주의를 기울이고, 떠오르는 마음을 판단 없이 알아차리는 연습.</p><ol class="method-list"><li><b>01</b><div><h3>알아차림</h3><p>지금 주의가 어디에 있는지 살펴봐요.</p></div></li><li><b>02</b><div><h3>허용하기</h3><p>떠오르는 느낌을 바꾸려 하지 않아요.</p></div></li><li><b>03</b><div><h3>돌아오기</h3><p>흩어진 주의를 감각으로 데려와요.</p></div></li><li><b>04</b><div><h3>머무르기</h3><p>잘했는지 판단하지 않고 잠시 머물러요.</p></div></li></ol><p>와인이 없어도 괜찮아요. 일상의 어떤 감각에서든 시작할 수 있어요.</p><p class="hint">연습은 로그인 없이 사용할 수 있어요. 기록과 사진, 작성 중인 글은 로그인 후 내 계정에 보관돼요.</p></div><div class="settings-policies"><div class="settings-row"><div><h2>안전 안내</h2><p>위기 상담 연락처와 서비스 범위 안내</p></div><button class="small-button" data-action="safety-notice">보기</button></div><div class="settings-row"><div><h2>이용약관</h2><p>커뮤니티 규칙(불쾌한 콘텐츠 무관용) 포함</p></div><button class="small-button" data-action="open-policy" data-policy="terms">보기</button></div><div class="settings-row"><div><h2>개인정보처리방침</h2><p>수집 항목과 보관·삭제 안내</p></div><button class="small-button" data-action="open-policy" data-policy="privacy">보기</button></div><div class="settings-row"><div><h2>지원·문의</h2><p>문의 연락처와 신고 처리 안내</p></div><button class="small-button" data-action="open-policy" data-policy="support">열기</button></div></div></section>`;}
async function action(a,el){
 if(authCallbackPending)return;
 if(a==='back')return view==='public-entry'?together():list();
 if(a==='retry-draft')return finishSnapshot?save():flushDraft();
 if(a==='copy-draft'){captureDraft();await shareMoment([draft.context,draft.wineName,draft.vintage,draft.note,...draft.conversation.map(m=>m.text)].filter(Boolean).join('\n\n'));return;}
 if(a==='reload-draft-preview'){if(finishSnapshot)throw Error('저장 결과를 먼저 확인해주세요.');popup('서버의 초안을 다시 열까요?','<p>이 화면에서 아직 전송되지 않은 내용은 버려져요. 필요한 내용은 먼저 복사해주세요.</p>','<button class="danger" data-action="reload-draft">서버의 초안 열기</button>');return;}
 if(a==='reload-draft'){const j=journal;const value=await j.reloadDraft();if(j!==journal)return;dialog.close();finishSnapshot=null;draftDirty=false;draftFailure=null;await editor(value||freshDraft());return;}

 if(a==='photo-remove'){const old=draft.photoPath;draft.photoPath=null;draftDirty=true;draftGeneration++;await flushDraft();await cloud.releasePhoto(old);document.querySelector('#photo-field').outerHTML=photoField();return;}
 if(a==='pin-record'){await syncCloud();const r=(await journal.list()).find(e=>e.id===record.id);await journal.save({...r,featured:!r.featured});await syncCloud();await detail((await journal.list()).find(e=>e.id===record.id));return;}
 if(a==='download-photo'){await savePhoto(await cloud.photo(record.photoPath,'full'),record.id);return;}
 if(a==='public-link'){await shareMoment(publicLink('post',record.id));return;}
 if(a==='archive-grid'||a==='archive-diary'){archiveLayout=a==='archive-grid'?'grid':'diary';return list(false);}
 if(a==='close'){dialog.close();return;}
 if(a==='open-policy'){await openExternal(POLICY_URLS[el.dataset.policy]||POLICY_URLS.support);return;}
 if(a==='safety-notice'){showSafetyNotice();return;}
 if(a==='safety-ack'){await markSafetySeen();dialog.close();return;}
 if(a==='home')await home();else if(a==='journal')await list();else if(a==='together')await together();else if(a==='settings')await settings();
 else if(a==='start')await start();else if(a==='discard-and-start'){if(accountUser&&draft?.photoPath)await cloud.releasePhoto(draft.photoPath);if(journal)await journal.storeDraft(null);await startFresh();}
 else if(a==='resume-session'){clock.resume(performance.now());cueKey='';player();tick();}
 else if(a==='pause'){if(clock.running)pause();else{clock.resume(performance.now());cueKey='';tick();}updatePlayer();}
 else if(a==='voice'){voice=!voice;stopSpeech();speechError='';cueKey='';updatePlayer();if(clock.running)tick();}
 else if(a==='next-stage'){stopSpeech();const s=clock.next(performance.now());cueKey='';if(s.done)await finish();else{player();tick();}}
 else if(a==='finish-early'){pause();popup('지금 느낀 것만 남겨도 좋아요.','<p>여기서 연습을 마치고, 알아차린 것을 짧게 기록할까요?</p>','<button class="primary" data-action="finish">기록하고 마치기</button>');}
 else if(a==='finish'){dialog.close();await finish();}
 else if(a==='write'){if(view==='editor')return;if(!await requireAccount({kind:'editor'}))return;await editor();}
 else if(a==='restore-draft'){dialog.close();const j=journal,epoch=viewEpoch;if(!j)return;const value=await j.reloadDraft();if(j!==journal||epoch!==viewEpoch)return;await editor(value);}
 else if(a==='entry'){const j=journal,epoch=viewEpoch;if(!j)return;const rows=await j.list();if(j!==journal||epoch!==viewEpoch)return;const item=rows.find(r=>r.id===el.dataset.id);if(item)await detail(item);}
 else if(a==='edit')await editor(record);
 else if(a==='share-preview')popup('이 내용으로 나눌까요?',`<p class="share-preview">${esc(shareText(record))}</p><p class="hint">돌아보기 대화는 포함되지 않아요.</p>`,'<button class="primary" data-action="share">공유할 곳 선택</button>');
 else if(a==='share'){const result=await shareMoment(shareText(record));dialog.close();if(result==='copied')toast('공유할 내용을 복사했어요.');}
 else if(a==='delete-preview')popup('이 기록을 지울까요?','<p>와인 정보와 돌아보기 대화도 함께 지워져요. 삭제한 기록은 되돌릴 수 없어요.</p>','<button class="danger" data-action="delete">기록 삭제</button>');
 else if(a==='delete'){await journal.remove(record.id);record=null;dialog.close();toast('기록을 서버에서 삭제했어요.');await list();syncCloud({quiet:true});}
 else if(a==='open-community')await openCommunity();

}
document.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(!el||saving||photoUpload)return;action(el.dataset.action,el).catch(error=>{if(error.name!=='AbortError'&&!/cancel/i.test(error.message))toast(error.message||'잠시 후 다시 시도해주세요.');});});
document.addEventListener('submit',e=>{if(e.target.id!=='record-form')return;e.preventDefault();save().catch(error=>toast(error.message));});
document.addEventListener('input',e=>{if(e.target.id==='archive-query'){archiveQuery=e.target.value;refreshArchive().catch(e=>toast(e.message));return;}if(view!=='editor'||!e.target.closest('#record-form')||finishSnapshot)return;draftDirty=true;draftGeneration++;clearTimeout(draftTimer);draftTimer=setTimeout(()=>flushDraft().catch(()=>{}),700);});
document.addEventListener('change',e=>{if(e.target.id==='archive-stage'){archiveStage=e.target.value;refreshArchive().catch(e=>toast(e.message));return;}if(e.target.id==='photo-file'){const file=e.target.files?.[0];if(file)photoUpload=attachPhoto(file).catch(e=>toast(e.message)).finally(()=>{photoUpload=null;});return;}if(e.target.name==='stage')document.querySelector('#note-question').textContent=STAGES.find(s=>s.id===e.target.value).question;});

bindLifecycle({pause,back:()=>{if(dialog.open)dialog.close();else if(view==='home')minimize().catch(e=>toast(e.message));else (view==='entry'||view==='editor'?list():view==='public-entry'?together():view==='account'?settings():home()).catch(e=>toast(e.message));}}).catch(()=>{});
if(!native&&location.hostname!=='terminal.local'&&'serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(()=>{});
async function routeHash(){
 if(authCallbackPending)return;
 const [name,id]=location.hash.slice(1).split('/');
 if(name==='home')return home();if(name==='settings')return settings();if(name==='account')return cloudUI.account();if(name==='together')return together();if(name==='journal')return list();
 if(!cloud)return;
 if(name==='post')return cloudUI.showPost(id);if(name==='profile')return cloudUI.profile(id);if(name==='people')return cloudUI.people();if(name==='notifications')return cloudUI.notifications();
}
async function initialize(){
 const callback=captureOAuthCallback(location,history),initialHash=location.hash;
 let googleIntent=null,googleError='';
 if(callback.active){authCallbackPending=true;document.body.inert=true;main.innerHTML='<p class="loading">로그인을 확인하고 있어요.</p>';}
 try{
 if(!callback.active)await home();
 try{
  cloud=await loadCloud(createAuthStorage(),{native});
  if(cloud){
   if(callback.active){try{googleIntent=await cloud.google.finish(callback);}catch{googleError='구글 로그인을 마치지 못했어요. 다시 시도하거나 이메일로 로그인해주세요.';}}
   await changeUser(await cloud.user());
   cloud.onAuth(user=>changeUser(user).catch(error=>toast(error.message)));
  }
 }catch(error){cloudError=error.message;toast('계정 연결을 확인하지 못했어요. 마음챙김 연습은 사용할 수 있어요.');}
 if(callback.active){
  if(googleIntent&&accountUser){pendingIntent={kind:googleIntent};toast('로그인했어요.');return await afterLogin();}
  await cloudUI.account();toast(googleError||'계정 연결을 확인하지 못했어요. 다시 로그인해주세요.');return;
 }
 if(view==='home')loadHomeFeed(viewEpoch);if(initialHash)history.replaceState(null,'',initialHash);await routeHash();
 if(!await safetySeen())showSafetyNotice();
 }finally{if(callback.active){authCallbackPending=false;document.body.inert=false;main.focus({preventScroll:true});}}
}
window.addEventListener('hashchange',()=>routeHash().catch(e=>toast(e.message)));
window.addEventListener('beforeunload',e=>{if(draftDirty||finishSnapshot||journal?.hasPending()){e.preventDefault();e.returnValue='';}});
window.addEventListener('online',()=>{if(view==='editor'&&draftDirty&&!finishSnapshot)flushDraft().catch(()=>{});else syncCloud({quiet:true});});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&view==='editor'&&!finishSnapshot)flushDraft().catch(()=>{});});
initialize().catch(error=>{main.innerHTML='<section><h1>기록을 불러오지 못했어요.</h1><p>'+esc(error.message)+'</p><p>기존 기록은 지우지 않았어요. 앱을 다시 열어주세요.</p></section>';});
