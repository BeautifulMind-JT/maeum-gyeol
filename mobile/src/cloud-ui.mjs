import {createSocialUI} from './social-ui.mjs';
import {newId} from './identity.mjs';
import {escapeHtml as esc} from './shared/model.mjs';
import {icon,cover,reviewCard,normalizePost,stageOf} from './presentation.mjs';
const dateLabel=d=>new Date(d).toLocaleDateString('ko-KR');
const button=(action,label,kind='secondary')=>`<button class="${kind}" data-cloud-action="${action}">${label}</button>`;
export function createCloudUI(ctx){
 const social=createSocialUI({...ctx,account:()=>account()});
 let email='',epoch=0,cloudView='',feedOffset=0,feedRows=[],post=null,commentRows=[],commentOffset=0,commentId=null,busy=false;
 const isCurrent=t=>t===epoch&&ctx.current()===cloudView;
 function begin(name){const t=++epoch;cloudView=name;ctx.screen(name);ctx.main.innerHTML='<p class="loading">기록을 불러오고 있어요.</p>';return t;}
 function errorCopy(error){if(error.status===429)return '잠시 뒤 다시 시도해주세요.';return error.message||'연결하지 못했어요. 작성한 내용은 그대로 두었어요.';}
 async function account(){
  await ctx.leave();const t=begin('account'),cloud=ctx.cloud(),user=ctx.user();
  if(!cloud){ctx.main.innerHTML=`<section><h1>내 기록과 계정</h1><p class="lead">${esc(ctx.cloudError()||'계정 연결을 확인하지 못했어요. 잠시 뒤 다시 열어주세요.')}</p><div class="settings-row"><button class="quiet" data-action="settings">마음결 소개</button></div></section>`;return;}
  let profile=null,legacy={count:0,exists:false};if(user){try{profile=await cloud.profile();}catch{ctx.toast('프로필을 불러오지 못했어요. 다시 연결해주세요.');}legacy=await ctx.legacyInfo();}
  const googleBlocked=!user&&ctx.googleLoginBlocked?.();
  const googleAvailable=!user&&!ctx.native&&!googleBlocked&&await cloud.google?.available();
  if(!isCurrent(t))return;
  ctx.main.innerHTML=`<section class="account"><p class="eyebrow">MY ACCOUNT</p><h1>${user?"내 계정":"마음결에 로그인"}</h1>${user?`<p class="lead">${esc(user.email||'내 계정')}<br>이 계정으로 저장한 기록을 다른 기기에서도 이어봐요.</p><div class="record-actions"><button class="primary" data-action="journal">나의 기록 보기</button></div>${ctx.legacyError()?`<section class="import-notice"><p>${esc(ctx.legacyError())}</p>${button('retry-legacy-account','이전 기록 옮기기 재시도')}</section>`:''}${legacy.exists?`<section class="import-notice"><p class="eyebrow">KEEP YOUR MOMENTS</p><h2>기기에 남아 있는 ${legacy.count}개의 순간${legacy.draft?'과 작성하던 글':''}</h2><p>로그인 전에 작성한 기록이에요. 이 계정에 보관하면 다른 기기에서도 이어볼 수 있어요.</p>${button('import-guest','내 계정으로 가져오기','secondary')}<p class="hint">내용을 확인한 뒤 비공개로 옮겨요.</p></section>`:''}<form id="cloud-profile"><label class="field"><span>닉네임</span><input name="name" maxlength="32" required value="${esc(profile?.name||'머무는 사람')}"></label><label class="field"><span>소개 <small>선택</small></span><textarea name="bio" maxlength="240">${esc(profile?.bio||'')}</textarea></label><p class="hint">닉네임과 소개는 다른 사람에게도 보여요.</p><button class="secondary" type="submit">프로필 저장</button></form><div class="settings-row"><button class="secondary" data-social-action="profile" data-id="${user.id}">내 공개 프로필</button><button class="quiet" data-social-action="blocks">차단한 계정</button></div><div class="settings-row">${button('logout','로그아웃')}${button('delete-account-preview','계정 삭제','danger')}</div>`:`<p class="lead">로그인하면 기록을<br>내 계정에 보관할 수 있어요.</p><label class="check-field consent-field"><input type="checkbox" id="policy-consent"> (필수) 이용약관과 개인정보처리방침에 동의해요.</label><p class="hint policy-links"><button type="button" class="inline-link" data-action="open-policy" data-policy="terms">이용약관</button> · <button type="button" class="inline-link" data-action="open-policy" data-policy="privacy">개인정보처리방침</button> · <button type="button" class="inline-link" data-action="open-policy" data-policy="support">지원·문의</button></p>${googleAvailable?`<div class="record-actions">${button('google-login','Google로 계속하기','secondary')}</div><p class="hint">또는 이메일로 로그인</p>`:''}${googleBlocked?'<p class="hint">지금 남기던 순간을 이어가려면 이메일로 로그인해주세요.</p>':''}<form id="cloud-email"><label class="field"><span>이메일</span><input type="email" name="email" required autocomplete="email" value="${esc(email)}"></label><button class="primary" type="submit">인증번호 받기</button></form><form id="cloud-code" ${email?'':'hidden'}><label class="field"><span>이메일로 받은 인증번호</span><input name="code" required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" maxlength="10"></label><button class="primary" type="submit">로그인</button></form>${cloud.reviewerEmail?'<form id="cloud-reviewer" hidden><label class="field"><span>검수 계정 비밀번호</span><input type="password" name="password" required autocomplete="current-password"></label><button class="primary" type="submit">검수 계정으로 로그인</button></form>':''}<p class="hint">처음 사용하는 이메일은 마음결 계정으로 가입돼요. 가입에는 약관(커뮤니티 규칙의 불쾌한 콘텐츠 무관용 원칙 포함) 동의가 필요해요. 기기에 있던 기록은 로그인 후 직접 옮길 수 있어요.</p>`}<div class="settings-row"><button class="quiet" data-action="settings">마음결 소개</button></div></section>`;
 }
 function cards(rows){return rows.map(reviewCard).join('');}
 // Sign-up and sign-in require explicit agreement to the terms, including the UGC rules.
 const requireConsent=()=>{if(!document.querySelector('#policy-consent')?.checked)throw Error('이용약관과 개인정보처리방침에 먼저 동의해주세요.');};
 async function feed(append=false){return social.feed(append);}
 async function showPost(id){return social.showPost(id);}
 async function action(name,el){
  if(name==='account')return account();
  if(name==='google-login'){requireConsent();return ctx.startGoogle();}
  if(name==='back-settings')return ctx.settings();
  if(name==='feed')return feed();
  if(name==='feed-more'){feedOffset+=20;try{return await feed(true);}catch(e){feedOffset-=20;throw e;}}
  if(name==='post')return showPost(el.dataset.id);
  if(name==='publish-preview'){
   const r=ctx.record();if(!ctx.user())return account();await ctx.sync();
   const current=(await ctx.journal().list()).find(e=>e.id===r.id);if(!current)throw Error('삭제된 기록이에요.');
   const publish=current.visibility!=='public';
   ctx.popup(publish?'이 순간을 함께 나눌까요?':'다시 나만 볼까요?',publish?'<p>사진·마음 기록·와인 정보·상황이 닉네임과 함께 공개돼요. 개인적인 돌아보기 답변은 공개되지 않아요.</p><p class="hint">공개 글에는 커뮤니티 규칙이 적용돼요. 불쾌감을 주는 콘텐츠는 허용되지 않아요(무관용). 신고된 글은 24시간 이내에 검토해요. <button type="button" class="inline-link" data-action="open-policy" data-policy="terms">규칙 보기</button></p>':'<p>공개 글과 댓글·좋아요가 삭제되고, 사진도 나만 볼 수 있게 돼요. 나의 개인 기록은 그대로 보관돼요.</p>',button(publish?'publish':'unpublish',publish?'규칙에 동의하고 공개하기':'나만 보기로 전환','primary'));return;
  }
  if(name==='publish'||name==='unpublish'){const j=ctx.journal(),id=ctx.record().id;await j.publish(id,name==='publish'?'public':'private');ctx.closeDialog();await ctx.sync();return ctx.detail((await j.list()).find(r=>r.id===id));}
  if(name==='retry-legacy-account'){await ctx.importLegacyAccount();return account();}
  if(name==='import-guest'){const info=await ctx.legacyInfo();ctx.popup('이 계정에 기록을 옮길까요?',`<p>${esc(ctx.user().email||'현재 계정')}에 이 기기의 기록 ${info.count}개${info.draft?'와 초안':''}를 비공개로 저장해요. 서버 보관을 확인한 뒤 이전 기기의 사본을 지워요.</p>`,button('confirm-import-guest','내 계정에 저장','primary'));return;}
  if(name==='confirm-import-guest'){await ctx.importLegacyGuest();ctx.closeDialog();ctx.toast('이전 기록을 내 계정에 보관했어요.');return ctx.list();}
  if(name==='logout'){await ctx.leave();const j=ctx.journal();if(await j.pending())throw Error('아직 서버에 저장되지 않은 기록이 있어요. 연결 후 다시 시도해주세요.');await ctx.cloud().signOut();await j.clear();await ctx.changeUser(null);return;}
  if(name==='delete-account-preview'){ctx.popup('마음결 계정을 삭제할까요?','<p>계정, 모든 사진과 개인 기록, 작성 중인 글, 공개 글, 와인 정보, 내가 쓴 댓글이 서버에서 삭제돼요. 되돌릴 수 없어요.</p>',button('delete-account','계정과 기록 삭제','danger'));return;}
  if(name==='delete-account'){const j=ctx.journal();await ctx.cloud().deleteAccount();await j.clear();ctx.closeDialog();await ctx.changeUser(null);ctx.toast('계정과 기록을 삭제했어요.');}
 }
 async function submit(form){
  const cloud=ctx.cloud();if(!cloud)throw Error('계정 저장 기능을 준비하고 있어요.');
  if(form.id==='cloud-email'){email=form.elements.email.value.trim();requireConsent();
   // The configured App Review account signs in with a password; OTP mail stays untouched.
   if(cloud.reviewerEmail&&email.toLowerCase()===cloud.reviewerEmail.toLowerCase()){const reviewer=document.querySelector('#cloud-reviewer');if(reviewer){email=cloud.reviewerEmail;reviewer.hidden=false;document.querySelector('#cloud-code').hidden=true;ctx.toast('검수 계정의 비밀번호를 입력해주세요.');return;}}
   await cloud.sendCode(email);document.querySelector('#cloud-code').hidden=false;ctx.toast('이메일의 인증번호를 입력해주세요.');}
  if(form.id==='cloud-code'){await cloud.verifyCode(email,form.elements.code.value.trim());await ctx.changeUser(await cloud.user());ctx.toast('로그인했어요.');return ctx.afterLogin();}
  if(form.id==='cloud-reviewer'){requireConsent();await cloud.signInWithPassword(email,form.elements.password.value);await ctx.changeUser(await cloud.user());ctx.toast('로그인했어요.');return ctx.afterLogin();}
  if(form.id==='cloud-profile'){await cloud.saveProfile(form.elements.name.value.trim(),form.elements.bio.value.trim());ctx.toast('프로필을 저장했어요.');}
  if(form.id==='cloud-comment'){const body=form.elements.body.value.trim();commentId=commentId||newId();await cloud.comment(post.id,body,commentId);return showPost(post.id);}
 }
 async function run(fn,el){if(busy)return;busy=true;if(el)el.disabled=true;try{await fn();}catch(error){ctx.toast(errorCopy(error));}finally{busy=false;if(el?.isConnected)el.disabled=false;}}
 document.addEventListener('click',e=>{const el=e.target.closest('[data-cloud-action]');if(el)run(()=>action(el.dataset.cloudAction,el),el);});
 document.addEventListener('submit',e=>{if(!e.target.id.startsWith('cloud-'))return;e.preventDefault();run(()=>submit(e.target),e.target.querySelector('button[type="submit"]'));});
 return {account,feed,showPost,profile:social.profile,people:social.people,notifications:social.notifications};
}
