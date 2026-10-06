import {escapeHtml as esc} from './shared/model.mjs';
import {STAGES} from './shared/tasting.mjs';

import {icon} from './icons.mjs';
export {icon};
export const stageOf = r => STAGES.find(s=>s.id===r.stage)||STAGES[3];
export const shortDate = d => new Date(d).toLocaleDateString('ko-KR',{month:'short',day:'numeric'});
export function normalizePost(r){return {...r,date:r.created_at,wineName:r.wine_name||'',vintage:r.vintage||'',photoPath:r.photo_path||null,commentsEnabled:r.comments_enabled!==false};}
export function cover(r,small=false){
 const title=r.context||r.wineName||'지금의 마음',photo=r.wineName?'summer-wine.webp':'summer-still.webp';
 return `<span class="moment-cover${small?' cover-small':''}"><span class="cover-photo${r.photoPath?' has-photo':''}"><img src="./${photo}" ${r.photoPath?'data-photo="'+esc(r.photoPath)+'"':''} alt="" loading="lazy"></span><span class="cover-title">${esc(title)}${r.vintage?' <small>'+esc(r.vintage)+'</small>':''}</span><span class="cover-bottom">${esc(shortDate(r.date))}</span></span>`;
}
export function momentCard(r){return `<button class="moment-card" data-action="entry" data-id="${esc(r.id)}">${cover(r)}<span class="card-meta"><span class="stage-label">${esc(stageOf(r).label)}</span><span class="card-privacy">${r.dirty?'저장 대기':r.visibility==='public'?'공개':icon('lock')+'나만'}</span></span><span class="card-note">${esc(r.note)}</span></button>`;}
export function reviewCard(p){const r=normalizePost(p);return `<button class="review-card" data-cloud-action="post" data-id="${esc(p.id)}">${cover(r,true)}<span class="review-content"><span class="author-line"><span class="avatar">${esc((p.author?.name||'머무는 사람').slice(0,1))}</span><strong>${esc(p.author?.name||'머무는 사람')}</strong><time>${esc(shortDate(r.date))}</time></span><span class="review-title">${esc(r.wineName||r.context||'지금의 마음')} ${r.vintage?'<small>'+esc(r.vintage)+'</small>':''}</span><span class="stage-label">${esc(stageOf(r).label)}</span><span class="review-note">${esc(r.note)}</span><span class="review-footer">${icon('chat')} 이야기 나누기</span></span></button>`;}
export function stats(entries){const minutes=Math.floor(entries.reduce((sum,r)=>sum+(Number(r.seconds)||0),0)/60),wines=new Set(entries.map(r=>r.wineName?.trim().toLocaleLowerCase()).filter(Boolean)).size;return `<div class="journal-stats"><div><strong>${entries.length}</strong><span>기록한 순간</span></div><div><strong>${minutes}<small>분</small></strong><span>머무른 시간</span></div><div><strong>${wines}</strong><span>함께한 와인</span></div></div>`;}
export function emptyJournal(){return `<div class="moment-grid first-moments"><button class="moment-card prompt-card" data-action="start"><span class="cover-photo"><img src="./summer-wine.webp" alt="햇빛 아래 와인 잔과 포도" loading="lazy"></span><span class="card-kicker">첫 연습</span><span class="cover-title">와인과 함께, 감각 깨우기</span><span class="card-note">향과 온도를 느끼며<br>지금의 나를 알아차려요.</span></button><button class="moment-card prompt-card" data-action="write"><span class="cover-photo"><img src="./summer-still.webp" alt="물잔과 펼치기 전의 노트" loading="lazy"></span><span class="card-kicker">첫 기록</span><span class="cover-title">와인 없이, 오늘의 한 줄</span><span class="card-note">잠시 멈춘 순간에<br>어떤 마음이 있었나요?</span></button></div>`;}

export function entryImage(r){return `<div class="entry-photo"><img src="./${r.wineName?'summer-wine.webp':'summer-still.webp'}" ${r.photoPath?'data-photo="'+esc(r.photoPath)+'" data-photo-size="full"':''} alt="이 순간의 사진"></div>`;}
export function entryHeading(r){return `${r.wineName||r.vintage?'<p class="entry-wine">'+esc(r.wineName||'함께한 와인')+(r.vintage?' · '+esc(r.vintage):'')+'</p>':''}<h1>${esc(r.context||'지금의 마음')}</h1>`;}

// Group in the viewer's local calendar, including records around UTC midnight.
export function diaryRows(entries){
 let last='';
 return '<div class="diary-list">'+entries.map(r=>{
  const date=new Date(r.date),month=date.toLocaleDateString('ko-KR',{year:'numeric',month:'long'});
  const heading=month===last?'':'<h2 class="diary-date">'+esc(month)+'</h2>';last=month;
  return heading+'<button class="diary-row" data-action="entry" data-id="'+esc(r.id)+'"><time class="diary-day" datetime="'+esc(r.date)+'"><strong>'+date.getDate()+'</strong><span>'+date.toLocaleDateString('ko-KR',{weekday:'short'})+'</span></time>'+cover(r,true)+'<span class="diary-copy"><span class="diary-title">'+esc(r.context||r.wineName||'지금의 마음')+'</span><span class="stage-label">'+esc(stageOf(r).label)+'</span><span class="card-note">'+esc(r.note)+'</span></span><span class="diary-privacy">'+(r.visibility==='public'?'공개':icon('lock')+' 나만')+'</span></button>';
 }).join('')+'</div>';
}
