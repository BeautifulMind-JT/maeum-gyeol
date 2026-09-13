export const WINE_KEY = 'maeum-gyeol:wine:v1';
export const STAGE_SECONDS = 45;
export const STAGES = [
  {
    "id": "color",
    "label": "알아차림",
    "english": "NOTICE",
    "title": "지금, 어디에 머물러 있나요?",
    "cues": [
      {
        "at": 0,
        "text": "잠시 멈춰보세요. 몸이 의자에 닿는 감각, 그리고 지금 떠오르는 생각을 알아차려요. 무엇이든 바꾸려 하지 않아도 괜찮아요."
      },
      {
        "at": 22,
        "text": "이제 잔의 색과 빛에 주의를 기울여봐요. 눈앞의 색을 보고 있나요, 다른 생각을 하고 있나요? 지금 주의가 있는 곳을 가만히 알아차려요."
      }
    ],
    "rest": "주의가 움직인다는 것을 알아차리는 연습.",
    "question": "주의가 어디에 머물러 있었나요?"
  },
  {
    "id": "aroma",
    "label": "허용하기",
    "english": "ALLOW",
    "title": "그런 마음도, 괜찮아요.",
    "cues": [
      {
        "at": 0,
        "text": "와인의 향을 편하게 느껴보세요. 향의 이름을 맞혀야 한다거나, 잘 느끼고 싶다는 마음이 있나요? 그런 생각이 있다면 그것도 알아차려봐요."
      },
      {
        "at": 22,
        "text": "잘하고 있는지 판단하는 마음이 들어도 밀어내지 않아요. 지금 이런 마음이 있구나, 하고 잠시 자리를 내주세요. 뚜렷한 감각이 없어도 괜찮아요."
      }
    ],
    "rest": "느낌도, 판단하는 마음도 있는 그대로.",
    "question": "평가하거나 바꾸고 싶은 마음이 있었나요?"
  },
  {
    "id": "texture",
    "label": "돌아오기",
    "english": "RETURN",
    "title": "부드럽게, 다시 여기로.",
    "cues": [
      {
        "at": 0,
        "text": "원한다면 아주 조금 맛보거나, 손에 닿는 잔의 온도를 느껴보세요. 지금 돌아올 수 있는 감각 하나를 정해요. 삼키지 않고 참여해도 좋아요."
      },
      {
        "at": 22,
        "text": "다른 생각이 떠오르면, 생각이 떠올랐구나 하고 알아차려요. 생각을 없애려 애쓰지 않고, 정해둔 감각으로 주의를 부드럽게 돌려봐요."
      }
    ],
    "rest": "돌아오는 그 순간이 마음챙김의 일부예요.",
    "question": "다른 생각에서 감각으로 돌아온 순간이 있었나요?"
  },
  {
    "id": "finish",
    "label": "머무르기",
    "english": "BE HERE",
    "title": "지금의 나를, 있는 그대로.",
    "cues": [
      {
        "at": 0,
        "text": "잔을 내려놓고 지금 몸과 마음에 무엇이 있는지 살펴봐요. 편안함, 조급함, 아무 느낌이 없는 상태. 어느 쪽이든 바로 바꾸려 하지 않아도 돼요."
      },
      {
        "at": 22,
        "text": "감각과 생각, 감정은 머물다가 달라질 수 있어요. 지금 알아차린 것과 잠시 함께 있어봐요. 이 연습을 마친 뒤에도 일상의 감각 하나로 돌아올 수 있어요."
      }
    ],
    "rest": "어떤 상태에 도달하려 애쓰지 않아도 돼요.",
    "question": "지금의 감각과 생각, 감정에서 무엇을 알아차렸나요?"
  }
];
export const TOTAL_SECONDS = STAGES.length * STAGE_SECONDS;

// The foreground-only clock never accumulates elapsed wall time while paused.
export class TastingClock {
  constructor() { this.elapsed = 0; this.activeSeconds = 0; this.running = false; this.last = null; this.lastCue = ''; }
  resume(now) { this.running = true; this.last = now; }
  pause(now) { this.tick(now); this.running = false; this.last = null; }
  tick(now) {
    if (this.running && this.last !== null) {
      const delta = Math.min(TOTAL_SECONDS - this.elapsed, Math.max(0, now - this.last) / 1000);
      this.elapsed += delta;
      this.activeSeconds += delta;
    }
    if (TOTAL_SECONDS - this.elapsed < 1e-7) this.elapsed = TOTAL_SECONDS;
    if (this.running) this.last = now;
    if (this.elapsed >= TOTAL_SECONDS) this.running = false;
    return this.snapshot();
  }
  next(now) { this.elapsed = Math.min(TOTAL_SECONDS, (this.snapshot().stage + 1) * STAGE_SECONDS); this.last = this.running ? now : null; return this.tick(now); }
  snapshot() {
    const stage = Math.min(STAGES.length - 1, Math.floor(this.elapsed / STAGE_SECONDS));
    const within = this.elapsed - stage * STAGE_SECONDS;
    const cueIndex = within >= STAGES[stage].cues[1].at ? 1 : 0;
    return { stage, within, cueIndex, remaining: Math.ceil(Math.max(0, TOTAL_SECONDS - this.elapsed)), done: this.elapsed >= TOTAL_SECONDS, running: this.running };
  }
  takeCue() {
    const s = this.snapshot();
    if (!this.running || s.done) return null;
    const key = `${s.stage}:${s.cueIndex}`;
    if (key === this.lastCue) return null;
    this.lastCue = key;
    return STAGES[s.stage].cues[s.cueIndex].text;
  }
  repeatCue() { this.lastCue = ''; }
  replayCurrentCue() {
    const s = this.snapshot();
    this.elapsed = s.stage * STAGE_SECONDS + STAGES[s.stage].cues[s.cueIndex].at;
    this.repeatCue();
  }
}
const clip = (value, length) => typeof value === 'string' ? value.slice(0, length) : '';
export function parseWineRecords(raw) {
  if (!raw) return [];
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('Invalid journal');
  return data.filter(r => r && typeof r.id === 'string' && typeof r.date === 'string' && Number.isFinite(Date.parse(r.date))).map(r => ({
    id: clip(r.id, 100), date: r.date, wine: clip(r.wine, 160), note: clip(r.note, 1600),
    context: clip(typeof r.context === 'string' ? r.context : r.wine, 160),
    wineName: clip(r.wineName, 160), vintage: clip(r.vintage, 4),
    stage: STAGES.some(s => s.id === r.stage) ? r.stage : 'finish',
    conversation: Array.isArray(r.conversation) ? r.conversation.filter(m => m && ['guide', 'you'].includes(m.role)).slice(0, 8).map(m => ({role: m.role, text: clip(m.text, 1600)})) : [],
    seconds: Math.min(86400, Math.max(0, Number(r.seconds) || 0)),
  })).sort((a,b) => Date.parse(b.date) - Date.parse(a.date));
}
export const REFLECTIONS = [
  '그 감각을 알아차리는 동안, 주의가 다른 곳으로 가기도 했나요? 어떻게 다시 돌아왔는지 떠올려봐요.',
  '이 시간을 마치며 나에게 남기고 싶은 말이 있나요? 짧은 한마디여도 좋아요.',
  '여기에 적은 말을 잠시 읽어보세요. 일상에서도 색 하나, 향 하나에 이렇게 머물러볼 수 있어요.',
];
