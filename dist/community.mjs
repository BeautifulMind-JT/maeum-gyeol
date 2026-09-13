import { api, signInPath } from './client-api.mjs';
import { escapeHtml as esc } from './model.mjs';
const dateLabel=d=>new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric'}).format(new Date(d));
const glyph='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v12H9l-5 4Z"/></svg>';
function wineIdentity(entry){
 if(!entry.wineName&&!entry.vintage)return '';
 return '<span class="wine-identity"><span class="wine-identity-label">함께한 와인</span><span>'+esc(entry.wineName||'이름 미기록')+(entry.vintage?' <span class="wine-vintage">· '+esc(entry.vintage)+'</span>':'')+'</span></span>';
}
export function createCommunity(config){
 const {main,toast,setScreen}=config;
 let view='',token=0,me=null,items=[],offset=0,hasMore=false,entry=null,comments=[],commentOffset=0,hasMoreComments=false,pendingComment=null;
 const navigate=target=>config.navigate(()=>show(target));
 const isCurrent=t=>t===token;
 const route=v=>{history.replaceState(null,'',location.pathname+location.search+'#'+v);document.querySelectorAll('[data-tab]').forEach(el=>el.setAttribute('aria-current',el.dataset.tab===(v==='journal'?'journal':v==='together'||v.startsWith('entry/')||v.startsWith('profile/')?'together':'practice')?'page':'false'));};
 function header(){
  const el=document.querySelector('#account-button');if(!el)return;
  el.textContent=me?.authenticated?'내 프로필':'로그인';
  el.setAttribute('aria-label',me?.authenticated?'내 프로필과 계정':'ChatGPT로 로그인');
 }
 async function refreshMe(){me=await api('/api/me');header();return me;}
 function gate(copy){
  return '<div class="account-gate"><p>'+copy+'</p><a class="primary center" target="_top" href="'+signInPath('/#'+view)+'">ChatGPT로 로그인</a><p class="subtle">연습과 공개된 이야기는 로그인 없이도 볼 수 있어요.</p></div>';
 }
 function cards(rows){
  return rows.map(e=>`<article class="moment-row"><div class="moment-byline"><button class="author-link" data-hub-action="profile" data-id="${esc(e.ownerId)}"><span class="initial">${esc((e.authorName||'머').charAt(0))}</span>${esc(e.authorName||'머무는 사람')}</button><time>${dateLabel(e.createdAt)}</time></div><button class="moment-content" data-hub-action="entry" data-id="${esc(e.id)}"><span class="scene-tag">${e.scene==='wine'?'와인과 함께':'일상에서'}${view==='journal'?' · '+(e.visibility==='public'?'공개':'나만 보기'):''}</span><p>${esc(e.note)}</p>${wineIdentity(e)}${e.context?'<span class="moment-context">'+esc(e.context)+'</span>':''}</button><button class="comment-link" data-hub-action="entry" data-id="${esc(e.id)}">${glyph}이야기 ${e.commentCount||0}</button></article>`).join('');
 }
 function listBody(){
  const rows=document.querySelector('#moment-list');if(!rows)return;
  rows.innerHTML=items.length?cards(items):'<div class="empty-moments"><span class="empty-mark">“</span><h2>'+(view==='journal'?'나의 첫 순간을 남겨보세요.':'아직 공개된 이야기가 없어요.')+'</h2><p>'+(view==='journal'?'무엇을 잘했는지보다, 무엇을 알아차렸는지.<br>짧은 한 줄부터 시작해요.':'각자가 알아차린 순간이 이곳에 모여요.<br>나의 기록에서 원하는 글을 공개할 수 있어요.')+'</p><button class="secondary" data-hub-action="'+(view==='journal'?'write':'journal')+'">'+(view==='journal'?'한 줄 기록하기':'나의 기록으로')+'</button></div>';
  const more=document.querySelector('#load-more');if(more)more.hidden=!hasMore;
 }
 async function loadList(append=false){
  const t=token;
  const path=view==='journal'?'/api/entries':view.startsWith('profile/')?'/api/profiles/'+view.slice(8):'/api/feed';
  const next=append?offset+20:0,data=await api(path+'?offset='+next);
  if(!isCurrent(t))return;
  offset=next;items=append?[...items,...data.items.filter(e=>!items.some(v=>v.id===e.id))]:data.items;hasMore=data.hasMore;
  if(data.profile){document.querySelector('#public-profile-title').textContent=data.profile.name;document.querySelector('#public-profile-bio').textContent=data.profile.bio||'알아차린 순간을 남기는 중이에요.';}
  listBody();
 }
 async function show(target){
  view=target;const t=++token;entry=null;pendingComment=null;setScreen('social');document.body.classList.add('social-mode');route(view);
  main.innerHTML='<div class="hub-loading" role="status">잠시, 이야기를 불러오고 있어요.</div>';main.focus({preventScroll:true});
  try {
   if(view==='journal'){
    await refreshMe();if(!isCurrent(t))return;
    main.innerHTML='<section class="hub-view"><div class="hub-title"><div><p class="eyebrow">MY MOMENTS</p><h1>내가 알아차린<br>작은 순간들.</h1></div><button class="secondary" data-hub-action="write">한 줄 기록</button></div><p class="hub-lead">기록은 나만 보게 저장돼요. 나누고 싶은 순간만 공개해요.</p>'+(me.authenticated?'<div id="moment-list"></div><button class="load-more" id="load-more" data-hub-action="more" hidden>더 보기</button>':gate('로그인하면 나의 기록을 다른 기기에서도 이어볼 수 있어요.'))+'<div class="legacy-link"><button class="quiet-link" data-hub-action="local">이 브라우저에 남긴 이전 기록</button></div></section>';
    if(me.authenticated)await loadList();
   }else if(view==='together'){
    main.innerHTML='<section class="hub-view"><p class="eyebrow">SHARED MOMENTS</p><h1>각자의 순간에,<br>잠시 머물러요.</h1><p class="hub-lead">같은 연습, 서로 다른 알아차림.<br>경험을 읽고 내 이야기를 건네보세요.</p><div id="moment-list"></div><button class="load-more" id="load-more" data-hub-action="more" hidden>더 보기</button></section>';
    await loadList();
   }else if(view==='account'){
    await refreshMe();if(!isCurrent(t))return;
    main.innerHTML='<section class="hub-view"><p class="eyebrow">MY PROFILE</p><h1>여기에서의 나.</h1>'+(me.authenticated?`<p class="hub-lead">닉네임과 소개는 공개한 기록, 댓글과 함께 보여요.</p><form id="profile-form"><label class="field"><span>닉네임</span><input name="name" maxlength="32" required value="${esc(me.profile?.name||'머무는 사람')}"></label><label class="field"><span>짧은 소개 <span class="optional">선택</span></span><textarea name="bio" maxlength="240" placeholder="이곳에서 어떤 순간을 남기고 싶나요?">${esc(me.profile?.bio||'')}</textarea></label><button class="primary center" type="submit">프로필 저장</button><p class="inline-result" role="status"></p></form>${me.profile?'<button class="quiet-link" data-hub-action="profile" data-id="'+esc(me.profile.id)+'">내 공개 기록 보기</button>':''}<div class="account-data-actions"><button class="quiet-link" data-hub-action="export-account">내 기록 내려받기</button><button class="danger" data-hub-action="delete-account">마음결 계정 삭제</button></div><div class="account-bottom"><a href="/signout-with-chatgpt?return_to=%2F" target="_top">로그아웃</a></div>`:gate('로그인하고 나의 이야기를 이어가세요.'))+'</section>';
   }else if(view==='delete-account'){
    await refreshMe();if(!isCurrent(t))return;
    main.innerHTML='<section class="hub-view"><p class="eyebrow">MY ACCOUNT</p><h1>마음결 계정 삭제</h1><p class="hub-lead">마음결의 프로필, 공개·비공개 기록, 와인 정보, 돌아보기 대화와 내가 쓴 댓글을 삭제해요. 내 기록에 달린 댓글도 함께 삭제되며 되돌릴 수 없어요.</p><p class="hub-lead">ChatGPT 계정은 삭제되지 않아요. 이 브라우저의 이전 기록은 나의 기록에서 별도로 지울 수 있어요.</p>'+(me.authenticated?'<div class="account-data-actions"><button class="secondary" data-hub-action="export-account">삭제 전 내 기록 내려받기</button><button class="danger" data-hub-action="request-delete-account">계정 삭제 진행</button></div><div id="account-delete-confirm"></div>':gate('본인의 마음결 계정을 삭제하려면 로그인해주세요.'))+'</section>';
   }else if(view.startsWith('profile/')){
    main.innerHTML='<section class="hub-view public-profile"><p class="eyebrow">A PERSON, MANY MOMENTS</p><h1 id="public-profile-title">공개 프로필</h1><p class="hub-lead" id="public-profile-bio"></p><div id="moment-list"></div><button class="load-more" id="load-more" data-hub-action="more" hidden>더 보기</button></section>';
    await loadList();
   }else if(view.startsWith('entry/')){
    try{await refreshMe();}catch{me=null;}
    if(!isCurrent(t))return;
    const data=await api('/api/entries/'+view.slice(6));if(!isCurrent(t))return;
    entry=data.entry;comments=data.comments;commentOffset=0;hasMoreComments=data.hasMoreComments;renderEntry();
   }else{navigate('journal');}
  }catch(error){if(isCurrent(t))main.innerHTML='<section class="hub-view"><p class="eyebrow">잠시 쉬어가는 중</p><h1>이야기를 불러오지 못했어요.</h1><p class="hub-lead">'+esc(error.message)+'</p><button class="primary center" data-hub-action="retry">다시 시도</button></section>';}
 }
 function renderComments(){
  const area=document.querySelector('#comments');if(!area)return;
  area.innerHTML=comments.length?comments.map(c=>`<article class="comment"><div class="moment-byline"><button class="author-link" data-hub-action="profile" data-id="${esc(c.authorId)}">${esc(c.authorName)}</button><time>${dateLabel(c.createdAt)}</time></div><p>${esc(c.body)}</p>${c.canDelete?'<button class="comment-delete" data-hub-action="delete-comment" data-id="'+esc(c.id)+'">삭제</button>':''}</article>`).join(''):'<p class="no-comments">이 순간을 읽으며 떠오른 이야기가 있나요?</p>';
  const more=document.querySelector('#more-comments');if(more)more.hidden=!hasMoreComments;
 }
 function renderEntry(){
  main.innerHTML=`<section class="hub-view entry-detail"><button class="quiet-link" data-hub-action="${entry.isOwner?'journal':'together'}">← ${entry.isOwner?'나의 기록':'함께'}</button><div class="entry-heading"><span class="scene-tag">${entry.scene==='wine'?'와인과 함께 알아차린 순간':'일상에서 알아차린 순간'}</span><span class="visibility-badge">${entry.visibility==='public'?'공개':'나만 보기'}</span></div><div class="moment-byline"><button class="author-link" data-hub-action="profile" data-id="${esc(entry.ownerId)}"><span class="initial">${esc(entry.authorName.charAt(0))}</span>${esc(entry.authorName)}</button><time>${dateLabel(entry.createdAt)}</time></div><h1 class="entry-quote">${esc(entry.note)}</h1>${wineIdentity(entry)}${entry.context?'<p class="entry-context">'+esc(entry.context)+'</p>':''}${entry.isOwner&&entry.conversation?.length?'<details class="private-reflection"><summary>나만 보는 돌아보기 대화</summary>'+entry.conversation.map(m=>'<p class="message '+m.role+'"><small>'+(m.role==='you'?'나의 이야기':'마음결의 질문')+'</small>'+esc(m.text)+'</p>').join('')+'</details>':''}${entry.isOwner?'<div class="entry-actions"><button class="secondary" data-hub-action="visibility">'+(entry.visibility==='public'?'나만 보기로 전환':'이 순간 공개하기')+'</button><button class="danger" data-hub-action="delete-entry">기록 삭제</button></div>':''}<div id="entry-confirm"></div><section class="discussion"><h2>이 순간에 건네는 이야기</h2><div id="comments"></div><button class="load-more" id="more-comments" data-hub-action="more-comments" hidden>이전부터 이어진 댓글 더 보기</button>${entry.visibility==='public'?(me?.authenticated?'<form id="comment-form"><label for="comment-body">내 경험에서 떠오르는 이야기를 건네보세요.</label><textarea id="comment-body" name="body" maxlength="1000" required placeholder="나는 이런 순간을 알아차렸어요."></textarea><div class="comment-submit"><span>서로의 경험을 존중하며 이야기해요.</span><button class="secondary" type="submit">댓글 남기기</button></div><p class="inline-result" role="status"></p></form>':'<a class="secondary signin-comment" target="_top" href="'+signInPath('/#'+view)+'">로그인하고 이야기 나누기</a>'):'<p class="no-comments">공개한 기록에서 댓글을 주고받을 수 있어요.</p>'}</section></section>`;
  renderComments();
 }
 function confirmation(kind,id){
  const area=document.querySelector('#entry-confirm');
  const publishing=kind==='visibility'&&entry.visibility==='private';
  area.innerHTML=`<section class="confirmation" role="region" aria-label="기록 변경 확인"><h2>${kind==='delete-entry'?'이 순간을 지울까요?':kind==='delete-comment'?'댓글을 지울까요?':publishing?'이 순간을 함께 나눌까요?':'다시 나만 볼까요?'}</h2><p>${kind==='delete-entry'?'기록과 달린 댓글이 함께 삭제돼요.':kind==='delete-comment'?'삭제한 댓글은 되돌릴 수 없어요.':publishing?'이 글과 장면, 와인 정보가 닉네임과 함께 누구에게나 공개돼요. 돌아보기 대화는 나만 볼 수 있어요.':'공개 목록과 다른 사람에게서 이 글을 숨겨요. 이미 읽은 사람이 저장한 내용은 회수할 수 없어요.'}</p><div class="dialog-actions"><button class="secondary" data-hub-action="cancel-confirm">돌아가기</button><button class="primary center" data-hub-action="confirm-${kind}" ${id?'data-id="'+esc(id)+'"':''}>${kind.startsWith('delete')?'삭제하기':publishing?'공개하기':'나만 보기로 전환'}</button></div></section>`;
  area.querySelector('button:last-child').focus({preventScroll:false});
 }
 document.addEventListener('click',async event=>{
  const el=event.target.closest('[data-hub-action]');if(!el)return;
  const a=el.dataset.hubAction;
  if(['journal','together','account','delete-account'].includes(a)){navigate(a);return;}
  if(a==='request-delete-account'){
   const area=document.querySelector('#account-delete-confirm');
   area.innerHTML='<section class="confirmation"><h2>모든 기록과 계정을 삭제할까요?</h2><p>계속하려면 아래에 ‘삭제’를 입력해주세요.</p><label class="field"><span>삭제 확인</span><input id="delete-account-text" autocomplete="off" placeholder="삭제"></label><div class="dialog-actions"><button class="secondary" data-hub-action="account">돌아가기</button><button class="danger" data-hub-action="confirm-delete-account">계정과 기록 삭제</button></div></section>';
   area.querySelector('input').focus();return;
  }
  if(a==='entry'||a==='profile'){navigate(a+'/'+el.dataset.id);return;}
  if(a==='write'){config.write();return;}
  if(a==='local'){config.localJournal();return;}
  if(a==='retry'){show(view);return;}
  if(a==='cancel-confirm'){document.querySelector('#entry-confirm').innerHTML='';return;}
  if(['visibility','delete-entry','delete-comment'].includes(a)){confirmation(a,el.dataset.id);return;}
  el.disabled=true;const actionToken=token;
  try{
   if(a==='export-account'){
    const data=await api('/api/account/export');
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='maeum-gyeol-records-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    toast('내 기록 파일을 내려받아요. 개인적인 내용이 포함되어 있어요.');
   }else if(a==='confirm-delete-account'){
    if(document.querySelector('#delete-account-text')?.value.trim()!=='삭제'){toast('확인란에 ‘삭제’를 입력해주세요.');return;}
    await api('/api/account',{method:'DELETE',body:{confirm:'DELETE'}});
    sessionStorage.removeItem('maeum-gyeol:pending-draft');
    if(actionToken!==token)return;
    me={authenticated:true,profile:null};header();
    main.innerHTML='<section class="hub-view"><h1>마음결 계정을 삭제했어요.</h1><p class="hub-lead">프로필과 계정에 저장한 기록, 작성한 댓글을 삭제했어요. 다시 기록을 저장하면 새 마음결 프로필이 만들어져요.</p><a class="secondary" href="/signout-with-chatgpt?return_to=%2F" target="_top">로그아웃하고 마치기</a></section>';
   }else if(a==='more')await loadList(true);
   else if(a==='more-comments'){
    const next=commentOffset+50,data=await api('/api/entries/'+entry.id+'?offset='+next);if(actionToken!==token)return;commentOffset=next;
    comments=[...comments,...data.comments.filter(c=>!comments.some(v=>v.id===c.id))];hasMoreComments=data.hasMoreComments;renderComments();
   }else if(a==='confirm-visibility'){
    const next=entry.visibility==='private'?'public':'private';await api('/api/entries/'+entry.id+'/visibility',{method:'PATCH',body:{visibility:next}});
    if(actionToken!==token)return;entry.visibility=next;renderEntry();toast(next==='public'?'이 순간을 공개했어요.':'이제 나만 볼 수 있어요.');
   }else if(a==='confirm-delete-entry'){
    await api('/api/entries/'+entry.id,{method:'DELETE'});if(actionToken!==token)return;toast('기록과 댓글을 삭제했어요.');await show('journal');
   }else if(a==='confirm-delete-comment'){
    await api('/api/comments/'+el.dataset.id,{method:'DELETE'});if(actionToken!==token)return;comments=comments.filter(c=>c.id!==el.dataset.id);document.querySelector('#entry-confirm').innerHTML='';renderComments();toast('댓글을 삭제했어요.');
   }
  }catch(error){toast(error.message);}finally{if(el.isConnected)el.disabled=false;}
 });
 document.addEventListener('submit',async event=>{
  if(!['comment-form','profile-form'].includes(event.target.id))return;event.preventDefault();
  const submitToken=token;const form=event.target,button=form.querySelector('button[type="submit"]'),result=form.querySelector('.inline-result');button.disabled=true;result.textContent='';
  try{
   const values=Object.fromEntries(new FormData(form));
   if(form.id==='profile-form'){
    const data=await api('/api/profile',{method:'PUT',body:values});if(submitToken!==token)return;me={authenticated:true,profile:data.profile};header();result.textContent='프로필을 저장했어요.';
   }else{
    const value=values.body.trim();if(!value)return;
    if(!pendingComment||pendingComment.body!==value)pendingComment={id:crypto.randomUUID(),body:value};
    await api('/api/entries/'+entry.id+'/comments',{method:'POST',body:pendingComment});if(submitToken!==token)return;form.reset();pendingComment=null;result.textContent='이야기를 남겼어요.';
    const data=await api('/api/entries/'+entry.id);if(submitToken!==token)return;comments=data.comments;commentOffset=0;hasMoreComments=data.hasMoreComments;renderComments();
   }
  }catch(error){result.textContent=error.message;}finally{if(button.isConnected)button.disabled=false;}
 });
 return {show,navigate,refreshMe,route,cancel(){token++;},async save(draft){
  const result=await api('/api/entries/'+draft.id,{method:'PUT',body:{note:draft.note,context:draft.context,wineName:draft.wineName,vintage:draft.vintage,scene:draft.scene||'wine',stage:draft.stage,seconds:draft.seconds,conversation:draft.conversation}});
  return result.entry;
 }};
}
