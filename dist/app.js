import { createCommunity } from './community.mjs';
import { signInPath } from './client-api.mjs';
import { STORAGE_KEY, parseRecords, PRACTICES, escapeHtml as esc } from './model.mjs';
import { WINE_KEY, STAGES, STAGE_SECONDS, TOTAL_SECONDS, TastingClock, parseWineRecords, REFLECTIONS } from './tasting.mjs';

const main = document.querySelector('#main');
const modal = document.querySelector('#modal');
const modalContent = document.querySelector('#modal-content');
const toastEl = document.querySelector('#toast');
const icons = {
  play: '<path d="m8 5 11 7-11 7Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  next: '<path d="m8 5 8 7-8 7"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  sound: '<path d="M11 5 6 9H3v6h3l5 4ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
  mute: '<path d="M11 5 6 9H3v6h3l5 4ZM16 9l5 6m0-6-5 6"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
};
const icon = key => '<svg viewBox="0 0 24 24" aria-hidden="true">' + icons[key] + '</svg>';
const dateText = date => new Intl.DateTimeFormat('ko-KR', { year:'numeric', month:'long', day:'numeric' }).format(new Date(date));
const clock = new TastingClock();
let screen = 'home', renderedStage = -1, renderedCue = '', toastTimer, speechToken = 0, speechWatchdog, speaking = false;
let voiceOn = 'speechSynthesis' in window, speechFailure = '', voice = null, wakeLock = null, replayOnResume = false;
let afterExit = null, pendingNavigation = null;
let draft = null, conversationOpen = false, saveStatus = '', dialogView = '', selectedRecord = null, pausedReason = '';

function toast(text) {
  toastEl.textContent = text; toastEl.classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 5000);
}
function chooseVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices().filter(v => /^ko(?:-|_)/i.test(v.lang) || v.lang === 'ko');
  voice = voices.find(v => v.localService) || voices[0] || null;
}
chooseVoice();
if ('speechSynthesis' in window) speechSynthesis.addEventListener('voiceschanged', chooseVoice);
function stopSpeech() {
  speechToken++; clearTimeout(speechWatchdog); speaking = false;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
function say(text) {
  stopSpeech();
  if (!voiceOn || speechFailure) { updateStatus(); return; }
  const token = speechToken;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ko-KR'; utterance.rate = 0.94; utterance.pitch = 1;
  if (voice) utterance.voice = voice;
  let started = false;
  const fail = () => {
    if (token !== speechToken) return;
    speechFailure = '이 브라우저에서 음성을 재생하지 못했어요. 화면 안내는 계속 이어져요.';
    stopSpeech(); updateStatus();
  };
  utterance.onstart = () => { if (token !== speechToken) return; started = true; clearTimeout(speechWatchdog); speaking = true; updateStatus(); };
  utterance.onend = () => { if (token !== speechToken) return; clearTimeout(speechWatchdog); speaking = false; updateStatus(); };
  utterance.onerror = event => { if (!['canceled','interrupted'].includes(event.error)) fail(); };
  try { speechSynthesis.speak(utterance); speechWatchdog = setTimeout(() => { if (!started) fail(); }, 7000); } catch { fail(); }
}
async function keepScreenOn() {
  if (!navigator.wakeLock || document.hidden || !clock.running) return;
  try {
    const lock = await navigator.wakeLock.request('screen');
    if (!clock.running || document.hidden) { await lock.release(); return; }
    wakeLock = lock;
    lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null; });
  } catch { /* Screen-on guidance remains visible when this optional API is unavailable. */ }
}
function releaseScreen() { if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }
function setScreen(next) {
  screen = next;
  if(next !== 'social') hub.cancel();
  document.body.classList.toggle('social-mode', next === 'social');
  document.body.classList.toggle('session-active', next === 'session');
  document.body.classList.toggle('reflection-mode', next === 'reflection');
}
function focusMain() { main.focus({ preventScroll:true }); }
function renderHome() {
  stopSpeech(); clock.running = false; releaseScreen(); setScreen('home');
  hub.route('practice');
  main.innerHTML = `<section class="intro"><p class="eyebrow">일상에서 만나는 마인드풀니스</p><h1>지금의 나를,<br>있는 그대로.</h1><p class="intro-copy">감각과 생각, 감정을 알아차리고<br>현재로 부드럽게 돌아오는 연습.</p><ol class="sense-list"><li>알아차림</li><li>판단 유보</li><li>돌아오기</li></ol><p class="practice-tag">오늘의 연습 <span>—</span> 와인과 함께</p><button class="primary" data-action="start"><span>3분 마음챙김 시작</span>${icon('play')}</button><p class="start-note">한 번 누르면, 음성 안내가 차례로 이어져요.<span>와인 한 잔을 준비하고, 지금의 나에게 시간을 내주세요.</span></p><div class="intro-bottom"><button class="quiet-link" data-action="method">어떤 연습인가요?</button><button class="quiet-link" data-action="silent-start">소리 없이 시작</button></div></section>`;
  focusMain();
}
function start(silent = false) {
  afterExit=null;pendingNavigation=null;Object.assign(clock, new TastingClock()); stopSpeech(); speechFailure = ''; pausedReason = ''; replayOnResume = false;
  voiceOn = !silent && 'speechSynthesis' in window;
  if (!silent && !voiceOn) speechFailure = '이 브라우저는 음성을 지원하지 않아 화면으로 안내해요.';
  draft = { id: crypto.randomUUID(), date: new Date().toISOString(), scene:'wine', context:'', wineName:'', vintage:'', note:'', stage:'finish', conversation:[], seconds:0 };
  conversationOpen = false; saveStatus = '';
  clock.resume(performance.now()); renderedStage = -1; renderedCue = '';
  setScreen('session'); renderPlayer(); tick(); keepScreenOn(); focusMain();
}
function renderPlayer() {
  const s = clock.snapshot(), stage = STAGES[s.stage];
  renderedStage = s.stage; renderedCue = '';
  main.innerHTML = `<section class="player"><div class="session-head"><p class="eyebrow">와인과 함께하는 마음챙김</p><button class="text-button" data-action="exit">마치기</button></div><ol class="stage-track" aria-label="마음챙김 진행">${STAGES.map((v,i) => `<li class="${i === s.stage ? 'active' : i < s.stage ? 'past' : ''}" ${i === s.stage ? 'aria-current="step"' : ''}>${v.label}<span>0${i+1}</span></li>`).join('')}</ol><p class="eyebrow">${stage.english} · 0${s.stage+1} / 04</p><h1>${stage.title}</h1><p class="cue" id="cue"></p><p class="rest-line">${stage.rest}</p><div class="player-meta"><span class="audio-state"><span class="audio-dot"></span><span id="audio-status"></span></span><span class="time" id="time" aria-label="남은 시간"></span></div><div class="progress" role="progressbar" aria-label="마음챙김 진행률" aria-valuemin="0" aria-valuemax="180"><div class="progress-fill"></div></div><div class="player-controls"><button class="primary" data-action="pause"></button><button class="next-button" data-action="next">${s.stage === 3 ? '마무리' : '다음 연습'}${icon('next')}</button></div><div class="player-options"><button class="voice-toggle" data-action="voice"></button><span class="screen-note">화면을 켜둔 채, 감각에 머물러요.</span></div><p class="pause-note" id="pause-note" role="status"></p><p class="audio-note" id="audio-note" role="status"></p></section>`;
  updatePlayer();
}
function updateStatus() {
  if (screen !== 'session') return;
  const status = document.querySelector('#audio-status');
  status.textContent = !clock.running ? '잠시 멈췄어요' : !voiceOn || speechFailure ? '화면으로 따라가요' : speaking ? '안내를 듣는 중' : '감각에 머무는 시간';
  status.parentElement.classList.toggle('speaking', speaking);
  document.querySelector('[data-action="pause"]').innerHTML = icon(clock.running ? 'pause' : 'play') + (clock.running ? '잠시 멈추기' : '이어가기');
  const toggle = document.querySelector('[data-action="voice"]');
  toggle.innerHTML = icon(voiceOn && !speechFailure ? 'sound' : 'mute') + (voiceOn && !speechFailure ? '음성 켜짐' : '음성 꺼짐');
  toggle.setAttribute('aria-pressed', String(voiceOn && !speechFailure));
  toggle.setAttribute('aria-label', voiceOn && !speechFailure ? '음성 안내 끄기' : '음성 안내 켜기');
  document.querySelector('#audio-note').textContent = speechFailure;
  document.querySelector('#pause-note').textContent = pausedReason;
}
function updatePlayer() {
  if (screen !== 'session') return;
  const s = clock.snapshot();
  if (s.stage !== renderedStage) { renderPlayer(); return; }
  const key = s.stage + ':' + s.cueIndex;
  if (renderedCue !== key) {
    const cue = document.querySelector('#cue');
    cue.setAttribute('aria-live', voiceOn && !speechFailure ? 'off' : 'polite');
    cue.textContent = STAGES[s.stage].cues[s.cueIndex].text; renderedCue = key;
  }
  document.querySelector('#time').textContent = `${Math.floor(s.remaining/60)}:${String(s.remaining%60).padStart(2,'0')} 남음`;
  document.querySelector('.progress-fill').style.width = (clock.elapsed / TOTAL_SECONDS * 100) + '%';
  document.querySelector('.progress').setAttribute('aria-valuenow', String(Math.floor(clock.elapsed)));
  updateStatus();
}
function tick() {
  if (screen !== 'session' || !clock.running) return;
  const s = clock.tick(performance.now());
  if (s.done) { complete(); return; }
  updatePlayer();
  const cue = clock.takeCue(); if (cue) say(cue);
}
setInterval(tick, 200);
function pause(reason = '') {
  if (screen !== 'session') return;
  replayOnResume = replayOnResume || speaking;
  clock.pause(performance.now()); stopSpeech(); pausedReason = reason; releaseScreen(); updatePlayer();
}
function resume() {
  if (screen !== 'session' || modal.open) return;
  pausedReason = '';
  if (replayOnResume && voiceOn && !speechFailure) {
    clock.replayCurrentCue();
    pausedReason = '중간에 멈춘 안내를 처음부터 다시 들려드려요.';
  }
  replayOnResume = false; clock.resume(performance.now()); tick(); keepScreenOn();
}
function complete() {
  stopSpeech(); clock.running = false; releaseScreen();
  if (draft) draft.seconds = Math.round(clock.activeSeconds);
  setScreen('complete');
  main.innerHTML = `<section class="completion"><div class="completion-mark">${icon('check')}</div><p class="eyebrow">A MOMENT TO KEEP</p><h1>이 순간에<br>머물렀네요.</h1><p>생각이 떠오르고 주의가 움직였나요?<br>그것을 알아차린 순간을 짧게 남겨보세요.</p><div class="completion-summary">알아차림 &nbsp; · &nbsp; 허용 &nbsp; · &nbsp; 돌아오기</div><button class="primary" data-action="reflect"><span>한 줄 남기기</span>${icon('arrow')}</button><button class="quiet-link" data-action="home">그냥, 이대로 마치기</button></section>`;
  focusMain();
}
function renderReflection() {
  setScreen('reflection');
  const stage = STAGES.find(s => s.id === draft.stage);
  main.innerHTML = `<section class="reflection"><p class="eyebrow">MY MINDFUL MOMENT</p><h1>내가 알아차린 순간.</h1><p class="lead">잘했는지 평가하지 않고, 내 안에서 일어난 일을 남겨요.</p><label class="field"><span>어떤 순간이었나요? <span class="optional">선택</span></span><input id="moment-context" maxlength="160" value="${esc(draft.context)}" placeholder="와인 한 잔, 퇴근길, 잠깐 멈춘 시간…" autocomplete="off"></label><fieldset class="wine-fields"><legend>함께한 와인 <span class="optional">선택</span></legend><div class="wine-inputs"><label class="field"><span>와인 이름</span><input id="wine-name" maxlength="160" value="${esc(draft.wineName)}" placeholder="생산자와 와인 이름" autocomplete="off"></label><label class="field"><span>빈티지</span><input id="wine-vintage" maxlength="4" value="${esc(draft.vintage)}" placeholder="연도 / NV" autocomplete="off" autocapitalize="characters" aria-describedby="vintage-hint"></label></div><p class="field-hint" id="vintage-hint">라벨에 적힌 이름을 남겨요. 빈티지를 모르면 비워둬도 괜찮아요.</p></fieldset><fieldset><legend>어떤 연습이 기억에 남나요?</legend><div class="stage-choices">${STAGES.map(s => `<label><input type="radio" name="sense" value="${s.id}" ${s.id === draft.stage ? 'checked' : ''}><span>${s.label}</span></label>`).join('')}</div></fieldset><label class="field"><span id="note-label">${stage.question}</span><textarea id="tasting-note" maxlength="1600" placeholder="다른 생각을 하던 나를 알아차렸고, 잔의 온도로 주의를 돌려봤어요.">${esc(draft.note)}</textarea></label><div id="conversation-area"></div><div class="form-actions"><button class="primary center" data-action="save">나만 보기로 저장</button><button class="secondary" data-action="conversation">조금 더 돌아보기</button></div><p class="storage-note">로그인하면 내 계정에 저장돼요. 공개는 저장 후 직접 선택해요.</p><div class="save-result" id="save-result" role="status">${esc(saveStatus)}</div><div class="saved-actions" id="saved-actions"></div><button class="quiet-link" data-action="home">마치기</button></section>`;
  if (conversationOpen) renderConversation();
  focusMain();
}
function updateDraft() {
  if (screen !== 'reflection') return;
  draft.context = document.querySelector('#moment-context').value;
  draft.wineName = document.querySelector('#wine-name').value;
  draft.vintage = document.querySelector('#wine-vintage').value.trim().toUpperCase();
  draft.note = document.querySelector('#tasting-note').value;
}
function renderConversation() {
  const area = document.querySelector('#conversation-area');
  const answers = draft.conversation.filter(m => m.role === 'you').length;
  area.innerHTML = `<section class="conversation"><h2>감각에서 나에게로</h2><p class="guide-note">미리 준비된 질문을 따라 스스로 돌아보는 시간이에요.</p><div id="messages" aria-live="polite">${draft.conversation.map(m => `<p class="message ${m.role}"><small>${m.role === 'you' ? '나의 이야기' : '마음결의 질문'}</small>${esc(m.text)}</p>`).join('')}</div>${answers < 3 ? '<form id="reflection-form"><textarea id="chat-input" maxlength="1600" aria-label="질문에 대한 나의 이야기" placeholder="떠오르는 것을 적어보세요." required></textarea><button class="send-button" type="submit" aria-label="답변 남기기">' + icon('arrow') + '</button></form>' : '<p class="storage-note">나만 보기로 저장하면 이 대화도 비공개로 함께 남아요.</p>'}</section>`;
  document.querySelector('[data-action="conversation"]').hidden = true;
}
function openConversation() {
  updateDraft(); conversationOpen = true;
  if (!draft.conversation.length) draft.conversation.push({ role:'guide', text:STAGES.find(s => s.id === draft.stage).question });
  renderConversation();
  document.querySelector('#chat-input')?.focus();
}
function readJournal() {
  const wine = parseWineRecords(localStorage.getItem(WINE_KEY));
  const legacy = parseRecords(localStorage.getItem(STORAGE_KEY));
  return [...wine.map(r => ({...r, kind:'wine'})), ...legacy.map(r => ({...r, kind:'legacy'}))].sort((a,b) => Date.parse(b.date) - Date.parse(a.date));
}
function draftSignature(value = draft) { return JSON.stringify({note:value.note,context:value.context,wineName:value.wineName,vintage:value.vintage,scene:value.scene,stage:value.stage,conversation:value.conversation}); }
async function saveDraft() {
  updateDraft(); submitReflection();
  if (!draft.note.trim()) {
    toast('지금 알아차린 것을 한 줄 남겨주세요.'); document.querySelector('#tasting-note').focus(); return false;
  }
  if (draft.vintage && !/^(?:[0-9]{4}|NV)$/.test(draft.vintage)) {
    toast('빈티지는 네 자리 연도 또는 NV로 적어주세요. 모르면 비워둬도 괜찮아요.'); document.querySelector('#wine-vintage').focus(); return false;
  }
  const targetDraft=draft,snapshot=structuredClone(draft),signature=draftSignature(snapshot);
  const button = document.querySelector('[data-action="save"]'); if (button) button.disabled = true;
  try {
    const user = await hub.refreshMe();
    if (screen !== 'reflection' || draft !== targetDraft) return false;
    if (!user.authenticated) {
      try { sessionStorage.setItem('maeum-gyeol:pending-draft', JSON.stringify(snapshot)); }
      catch { toast('로그인 전에 적은 내용을 보관하지 못했어요. 내용을 복사한 뒤 로그인해주세요.'); return false; }
      document.querySelector('#save-result').innerHTML = '<a class="primary center" target="_top" href="' + signInPath('/?resume=1#reflection') + '">작성한 내용을 보관하고 로그인</a>';
      toast('로그인한 뒤 이 내용을 이어서 저장할 수 있어요.'); return false;
    }
    await hub.save(snapshot); targetDraft.savedSignature = signature;
    if(screen !== 'reflection' || draft !== targetDraft) return false;
    saveStatus = '나만 보는 기록으로 저장했어요.';
    document.querySelector('#save-result').textContent = saveStatus;
    document.querySelector('#saved-actions').innerHTML = '<button data-action="saved-entry">기록 열기 · 공개 범위 선택 →</button>';
    toast(saveStatus); return true;
  } catch(error) { toast(error.message); return false; }
  finally { if(button?.isConnected) button.disabled=false; }
}
function modalHead(title) { return `<div class="modal-head"><h2 id="modal-title">${esc(title)}</h2><button class="close-button" data-action="close" aria-label="닫기">${icon('close')}</button></div>`; }
function showModal(view, html) {
  if (screen === 'session' && clock.running) pause('화면을 닫은 뒤 이어갈 수 있어요.');
  dialogView = view; modalContent.innerHTML = html;
  if (!modal.open) modal.showModal();
}
function showLocalJournal() {
  let records;
  try { records = readJournal(); } catch {
    showModal('journal', modalHead('나의 기록') + '<p class="error-message">이 브라우저의 기록을 읽지 못했어요. 기존 데이터는 그대로 두었어요.</p>'); return;
  }
  showModal('journal', modalHead('나의 기록') + `<p class="journal-meta">이 브라우저에 남겨둔 ${records.length}개의 순간</p>${records.length ? '<ul class="record-list">' + records.map(r => `<li><button class="record-button" data-action="local-record" data-id="${esc(r.id)}" data-kind="${r.kind}"><time>${dateText(r.date)} · ${r.kind === 'wine' ? '와인 테이스팅' : '이전 마음 연습'}</time><strong>${esc(r.kind === 'wine' ? r.wine || '이름 없이 남긴 한 잔' : PRACTICES[r.practice].title)}</strong><p>${esc(r.note || r.reflection || r.takeaway || '남겨둔 이야기를 열어보세요.')}</p></button></li>`).join('') + '</ul><div class="journal-actions"><button class="text-button" data-action="export">기록 내려받기</button><button class="danger" data-action="clear-confirm">모든 기록 삭제</button></div>' : '<p class="empty-records">아직 남겨둔 순간이 없어요.<br>테이스팅을 마치고 한 줄을 남겨보세요.</p>'}`);
}
function showLocalRecord(id, kind) {
  let r; try { r = readJournal().find(v => v.id === id && v.kind === kind); } catch { toast('기록을 읽지 못했어요.'); return; }
  if (!r) { showLocalJournal(); return; }
  selectedRecord = { id, kind };
  const title = kind === 'wine' ? r.wine || '한 잔에 머문 순간' : PRACTICES[r.practice].title;
  const body = kind === 'wine'
    ? `<span class="detail-label">${STAGES.find(s => s.id === r.stage).label}에 머문 기록</span><p class="detail-note">${esc(r.note || '별도의 감각 메모를 남기지 않았어요.')}</p>${r.conversation.length ? '<span class="detail-label">조금 더 돌아본 이야기</span>' + r.conversation.map(m => `<p class="message ${m.role}"><small>${m.role === 'you' ? '나' : '마음결의 질문'}</small>${esc(m.text)}</p>`).join('') : ''}`
    : [['연습 전',r.note],['처음 떠오른 이야기',r.answer],['연습하며 알아차린 것',r.inquiry],['돌아본 이야기',r.reflection],['남기고 싶은 말',r.takeaway],['연습 후',r.after]].filter(([,v]) => v).map(([k,v]) => `<span class="detail-label">${k}</span><p class="detail-note">${esc(v)}</p>`).join('');
  showModal('record', modalHead(title) + `<p class="journal-meta">${dateText(r.date)}</p>${body}<div class="journal-actions"><button class="text-button" data-action="local-journal">← 기록 목록</button><button class="danger" data-action="delete-confirm">이 기록 삭제</button></div>`);
}
function confirmDelete(all = false) {
  showModal(all ? 'clear' : 'delete', modalHead(all ? '모든 기록을 지울까요?' : '이 기록을 지울까요?') + '<p class="dialog-copy">삭제한 기록은 되돌릴 수 없어요.</p><div class="dialog-actions"><button class="secondary" data-action="local-journal">돌아가기</button><button class="primary" data-action="' + (all ? 'clear' : 'delete') + '">삭제하기</button></div>');
}
function deleteRecord(all = false) {
  try {
    if (all) { localStorage.removeItem(WINE_KEY); localStorage.removeItem(STORAGE_KEY); }
    else {
      const key = selectedRecord.kind === 'wine' ? WINE_KEY : STORAGE_KEY;
      const raw = localStorage.getItem(key), parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) throw new Error('Invalid journal');
      localStorage.setItem(key, JSON.stringify(parsed.filter(r => r?.id !== selectedRecord.id)));
    }
    showLocalJournal(); toast(all ? '모든 기록을 삭제했어요.' : '기록을 삭제했어요.');
  } catch { toast('기록을 삭제하지 못했어요. 브라우저 저장 공간을 확인해주세요.'); }
}
function exportRecords() {
  try {
    const blob = new Blob([JSON.stringify({wine:parseWineRecords(localStorage.getItem(WINE_KEY)), previous:parseRecords(localStorage.getItem(STORAGE_KEY))}, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'maeum-gyeol-notes.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch { toast('기록을 내려받지 못했어요.'); }
}
function about(method = false) {
  showModal('about', modalHead(method ? '한 잔으로 하는 마음챙김' : '마음결에 대하여') + `<div class="dialog-copy"><p>일상에서 마음챙김을 실천하고, 내가 알아차린 순간을 기록하며, 서로의 경험을 나눠요. 와인테이스팅은 감각을 통해 현재로 돌아오는 첫 연습이에요.</p><ul class="method-list"><li><b>주의</b><span>감각뿐 아니라 지금 떠오르는 생각과 감정, 주의가 머무는 곳을 알아차려요.</span></li><li><b>판단 유보</b><span>잘 느끼는지, 좋은 와인인지 평가하기 전에 경험 자체를 살펴봐요.</span></li><li><b>돌아오기</b><span>다른 생각을 알아차린 순간, 감각으로 부드럽게 돌아와요.</span></li></ul><p>알아차림·허용하기·돌아오기·머무르기를 각각 45초씩 연습해요. 향과 잔의 촉감만으로 참여하거나 언제든 건너뛰어도 좋아요.</p><h3>음성 안내</h3><p>기기의 한국어 음성 기능으로 준비된 안내를 읽어요. 음성이 재생되지 않으면 같은 내용을 화면에서 볼 수 있어요. 다른 앱으로 이동하거나 화면을 잠그면 연습을 잠시 멈춰요.</p><h3>나의 기록</h3><p>로그인하고 저장한 기록은 계정에 연결되어 다른 기기에서도 볼 수 있어요. 처음에는 나만 보기로 저장돼요. 직접 공개하면 본문과 장면, 닉네임이 누구에게나 보이고 댓글을 주고받을 수 있어요. 돌아보기 대화는 공개되지 않아요. 이전 버전의 브라우저 기록은 ‘나의 기록’ 아래에서 계속 볼 수 있어요.</p><h3>안내의 바탕</h3><p class="small">현재 순간에 주의를 기울이는 마음챙김 원리를 참고해 만든 짧은 감각 연습이에요. 완전한 MBSR 과정이나 검증된 치료 프로그램은 아니며, 전문가 검토와 임상 검증을 거치지 않았어요. 돌아보기 대화는 미리 준비된 질문으로 진행되고 AI 상담은 연결되어 있지 않아요.</p><p class="small"><a href="https://www.ummhealth.org/services-treatments/center-mindfulness/mindfulness-programs/mbsr" target="_blank" rel="noopener noreferrer">UMass Memorial · MBSR 알아보기 ↗</a></p><button class="quiet-link" data-action="support">사람의 도움이 필요할 때</button></div>`);
}
function support() {
  showModal('support', modalHead('도움이 필요할 때') + '<div class="dialog-copy"><p>지금 연습이 불편하다면 잔을 내려놓고 주변을 천천히 살펴보세요. 가까운 사람에게 함께 있어 달라고 부탁해도 좋아요.</p><p>한국에서 위기 상황이라면 <a href="tel:109">자살예방상담전화 109</a>, 긴급한 위험에는 <a href="tel:119">119</a>로 연락할 수 있어요.</p></div>');
}
function requestHome(next = renderHome) {
  pendingNavigation = next;
  if (screen === 'session') { afterExit=next; requestExit(); return; }
  updateDraft();
  if (document.querySelector('#chat-input')?.value.trim()) submitReflection();
  if (screen === 'reflection' && (draft.note || draft.context || draft.wineName || draft.vintage || draft.conversation.some(m => m.role === 'you')) && draft.savedSignature !== draftSignature()) {
    showModal('leave', modalHead('기록을 남겨둘까요?') + '<p class="dialog-copy">아직 저장하지 않은 이야기가 있어요.</p><div class="dialog-actions"><button class="secondary" data-action="discard">저장 없이 이동</button><button class="primary" data-action="save-leave">저장하고 이동</button></div>'); return;
  }
  pendingNavigation=null;next();
}
function finishNavigation() { const next=pendingNavigation||renderHome;pendingNavigation=null;modal.close();next(); }
function requestExit() {
  pause();
  showModal('exit', modalHead('여기서 마칠까요?') + '<p class="dialog-copy">지금까지 느낀 것만으로도 괜찮아요. 원하면 짧게 기록하고 마칠 수 있어요.</p><div class="dialog-actions"><button class="secondary" data-action="continue">조금 더 머물기</button><button class="primary" data-action="finish">여기서 마치기</button></div>');
}
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  const action = button.dataset.action;
  if (action === 'start') start();
  else if (action === 'silent-start') start(true);
  else if (action === 'pause') clock.running ? pause() : resume();
  else if (action === 'next') { stopSpeech(); replayOnResume = false; const s = clock.next(performance.now()); if (s.done) complete(); else { renderPlayer(); if (clock.running) tick(); } }
  else if (action === 'voice') {
    if (!('speechSynthesis' in window)) { speechFailure = '이 브라우저는 음성을 지원하지 않아 화면으로 안내해요.'; updateStatus(); return; }
    voiceOn = speechFailure ? true : !voiceOn; speechFailure = ''; stopSpeech(); clock.repeatCue(); chooseVoice(); if (clock.running) tick(); else updateStatus();
  }
  else if (action === 'exit') requestExit();
  else if (action === 'close') modal.close();
  else if (action === 'continue') { afterExit=null;pendingNavigation=null;modal.close(); resume(); }
  else if (action === 'finish') { modal.close(); if(afterExit){const next=afterExit;afterExit=null;pendingNavigation=null;clock.running=false;stopSpeech();releaseScreen();next();}else complete(); }
  else if (action === 'reflect') renderReflection();
  else if (action === 'home') requestHome();
  else if (action === 'discard') finishNavigation();
  else if (action === 'save-leave') { modal.close(); if(await saveDraft()) finishNavigation(); }
  else if (action === 'save') await saveDraft();
  else if (action === 'saved-entry') hub.navigate('entry/'+draft.id);
  else if (action === 'conversation') openConversation();
  else if (action === 'journal') hub.navigate('journal');
  else if (action === 'local-journal') showLocalJournal();
  else if (action === 'local-record') showLocalRecord(button.dataset.id, button.dataset.kind);
  else if (action === 'delete-confirm') confirmDelete();
  else if (action === 'clear-confirm') confirmDelete(true);
  else if (action === 'delete') deleteRecord();
  else if (action === 'clear') deleteRecord(true);
  else if (action === 'export') exportRecords();
  else if (action === 'about') about();
  else if (action === 'method') about(true);
  else if (action === 'support') support();
});
document.querySelector('.brand').addEventListener('click', event => { event.preventDefault(); requestHome(); });
document.addEventListener('input', event => {
  if (['moment-context','wine-name','wine-vintage','tasting-note','chat-input'].includes(event.target.id)) {
    saveStatus = ''; const result = document.querySelector('#save-result'); if (result) result.textContent = '';
  }
});
document.addEventListener('change', event => {
  if (event.target.name === 'sense') {
    draft.stage = event.target.value; document.querySelector('#note-label').textContent = STAGES.find(s => s.id === draft.stage).question;
    saveStatus = ''; document.querySelector('#save-result').textContent = '';
  }
});
function submitReflection() {
  const input = document.querySelector('#chat-input'), text = input?.value.trim();
  if (!text) return;
  updateDraft();
  const count = draft.conversation.filter(m => m.role === 'you').length;
  if (count >= 3) return;
  draft.conversation.push({role:'you', text}, {role:'guide', text:REFLECTIONS[count]});
  saveStatus = ''; document.querySelector('#save-result').textContent = ''; renderConversation();
}
document.addEventListener('submit', event => {
  if (event.target.id !== 'reflection-form') return;
  event.preventDefault();
  submitReflection(); document.querySelector('#chat-input')?.focus();
});
modal.addEventListener('click', event => { if (event.target === modal) { const r = modal.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) modal.close(); } });
modal.addEventListener('close', () => { if (screen === 'session' && !clock.running) { pausedReason = '준비되면 이어가기를 눌러주세요.'; updateStatus(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'session' && clock.running) pause('화면을 떠난 동안 잠시 멈췄어요. 준비되면 이어가기를 눌러주세요.'); });
window.addEventListener('pagehide', () => { if (screen === 'session') pause(); else stopSpeech(); });
window.addEventListener('storage', () => { if (modal.open && dialogView === 'journal') showLocalJournal(); });

const hub = createCommunity({
  main, toast, setScreen,
  navigate: next => requestHome(next),
  localJournal: showLocalJournal,
  write: () => requestHome(() => {
    draft={id:crypto.randomUUID(),date:new Date().toISOString(),scene:'daily',context:'',wineName:'',vintage:'',note:'',stage:'finish',conversation:[],seconds:0};
    conversationOpen=false;saveStatus='';renderReflection();
  }),
});
document.addEventListener('click', event => {
  const tab=event.target.closest('[data-tab]');if(!tab)return;
  if(tab.dataset.tab==='practice')requestHome();else hub.navigate(tab.dataset.tab);
});
const initialHash=location.hash.slice(1);
renderHome();
const resumeRequested=new URLSearchParams(location.search).get('resume')==='1';
if(resumeRequested){
  try {
    const raw=sessionStorage.getItem('maeum-gyeol:pending-draft'),value=raw?JSON.parse(raw):null;
    const restored=value?parseWineRecords(JSON.stringify([value]))[0]:null;
    if(restored){draft={...restored,scene:value.scene==='daily'?'daily':'wine'};conversationOpen=Boolean(draft.conversation.length);saveStatus='';renderReflection();toast('적어둔 내용을 불러왔어요. 저장하면 내 기록에 남아요.');sessionStorage.removeItem('maeum-gyeol:pending-draft');}
  }catch{toast('로그인 전에 적은 내용을 불러오지 못했어요.');}
}
hub.refreshMe().catch(()=>{ document.querySelector('#account-button').textContent='계정 확인'; });
const initialRoute=location.pathname==='/delete-account'?'delete-account':initialHash;
if(['journal','together','account','delete-account'].includes(initialRoute)||/^(entry|profile)\/[a-f0-9-]{36}$/i.test(initialRoute))hub.show(initialRoute);
