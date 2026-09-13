export const STORAGE_KEY = 'maeum-gyeol:journal:v1';
export const MOODS = [
  { id:'calm', label:'차분해요', symbol:'◡', recommendation:'attention' },
  { id:'busy', label:'복잡해요', symbol:'≈', recommendation:'attention' },
  { id:'uneasy', label:'불안해요', symbol:'⌁', recommendation:'emotion' },
  { id:'tired', label:'지쳤어요', symbol:'−', recommendation:'kindness' },
  { id:'unsure', label:'잘 모르겠어요', symbol:'·', recommendation:'attention' },
];
export const ANCHORS = {
  sound: {label:'주변 소리', icon:'sound', guide:'가까이 또는 멀리서 들리는 소리 하나를 알아차려보세요. 이름을 붙이거나 소리를 찾으려 애쓰지 않아도 괜찮아요.'},
  feet: {label:'발바닥 감각', icon:'foot', guide:'발바닥이 바닥에 닿는 느낌을 살펴보세요. 무게나 온도, 압력이 느껴질 수도 있고, 뚜렷한 느낌이 없을 수도 있어요.'},
  breath: {label:'자연스러운 호흡', icon:'wind', guide:'호흡을 조절하지 않고, 평소처럼 숨 쉬는 감각을 살펴보세요. 마음이 다른 곳으로 가면 알아차리고 부드럽게 돌아와요.'},
};
export const PRACTICES = {
  attention: {
    id:'attention', number:'01', title:'지금, 여기로 돌아오기', short:'주의 돌아오기', subtitle:'생각이 많아 잠깐 멈추고 싶을 때', duration:'약 3분', tag:'주의 알아차림', icon:'circle', color:'blue',
    intro:'마음이 다른 곳으로 가는 건 자연스러운 일이에요. 알아차린 순간, 편한 감각으로 다시 돌아오는 연습을 해볼까요?',
    question:'지금 주의가 머무는 곳은 어디인가요?', choices:['이미 지나간 일','앞으로 일어날 일','여러 생각 사이','지금의 감각','잘 모르겠어요'], placeholder:'마음에 떠오르는 것을 짧게 적어도 좋아요.',
    timerTitle:'돌아올 곳 하나를 정해요', timerHint:'주의가 멀어졌다면, 알아차린 그 순간부터 다시 돌아와요.',
    inquiry:'잠깐 머무르는 동안 무엇을 알아차렸나요?', inquiryHelp:'집중이 계속되지 않았어도 괜찮아요. 주의가 움직였다는 것을 알아차린 경험을 살펴봐요.', inquiryChoices:['다른 생각으로 갔어요','다시 돌아온 순간이 있었어요','감각이 조금 느껴졌어요','잘 모르겠어요'],
    takeaway:'일상에서 다시 돌아오고 싶을 때, 어떤 감각을 떠올려볼까요?', suggestions:['주변 소리 잠깐 듣기','발바닥 감각 알아차리기','한 번의 자연스러운 호흡 느끼기'],
  },
  emotion: {
    id:'emotion', number:'02', title:'마음에 이름 붙이기', short:'감정 알아차리기', subtitle:'설명하기 어려운 감정이 남아 있을 때', duration:'약 5분', tag:'감정 알아차림', icon:'wave', color:'purple',
    intro:'지금 느끼는 감정을 편한 만큼만 살펴볼 거예요. 감정이 존재한다는 것을 인정하면서, 나에게 필요한 것을 찾아봐요.',
    question:'지금의 감정에 가까운 이름이 있나요?', choices:['서운함','화','걱정','슬픔','여러 감정','잘 모르겠어요'], placeholder:'내 말로 감정의 이름을 적어도 좋아요.',
    timerTitle:'이 감정과 잠깐 머물러요', timerHint:'감정을 당장 바꾸려 애쓰지 않아도 돼요. 벅차면 주변 소리로 주의를 옮기거나 멈출 수 있어요.',
    inquiry:'지금 나에게 필요한 것은 무엇일까요?', inquiryHelp:'원인을 깊게 파헤칠 필요는 없어요. 알아차린 감정에 어떤 배려를 건네고 싶은지 살펴봐요.', inquiryChoices:['잠깐 쉬기','누군가에게 이야기하기','조금 더 생각할 시간','필요한 것을 요청하기','아직 모르겠어요'],
    takeaway:'연습을 마친 뒤, 나를 위해 할 수 있는 작은 행동은?', suggestions:['조금 쉬어가기','믿을 만한 사람에게 이야기하기','답하기 전에 잠깐 멈추기'],
  },
  kindness: {
    id:'kindness', number:'03', title:'나에게 조금 더 다정하게', short:'자기돌봄', subtitle:'자신에게 너무 엄격했던 하루에', duration:'약 4분', tag:'자기연민', icon:'heart', color:'rose',
    intro:'스스로를 몰아붙이는 마음도 알아차릴 수 있어요. 오늘의 나에게 조금 더 다정한 말을 건네는 시간을 가져봐요.',
    question:'오늘 나 자신에게 어떤 마음이 들었나요?', choices:['충분히 못 했다는 마음','실수에 대한 자책','다른 사람과 비교하는 마음','쉬어도 되는지 망설임','잘 모르겠어요'], placeholder:'반복해서 떠오른 말을 적어도 좋아요.',
    timerTitle:'지금의 나에게 자리를 내줘요', timerHint:'자신에게 다정해지기 어렵다는 마음도 살펴볼 수 있어요. 어떤 감정을 억지로 만들 필요는 없어요.',
    inquiry:'소중한 사람이 같은 하루를 보냈다면 어떤 말을 건네고 싶나요?', inquiryHelp:'지금 내가 받아들일 수 있는 말이면 충분해요. 좋은 말을 꼭 찾아내지 않아도 괜찮아요.', inquiryChoices:['오늘 애썼어','잠깐 쉬어도 괜찮아','지금 어려움을 겪고 있구나','천천히 해도 돼'],
    takeaway:'오늘의 나에게 남겨두고 싶은 말은?', suggestions:['잠깐 쉬어도 괜찮아','내 속도로 해볼게','오늘의 어려움을 인정해줄게'],
  },
};
export function recommend(mood) { return MOODS.find(m=>m.id===mood)?.recommendation || 'attention'; }
export function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function parseRecords(raw) {
  if (!raw) return [];
  const data=JSON.parse(raw);
  if(!Array.isArray(data)) throw new Error('Invalid journal');
  return data.filter(r=>r && typeof r.id==='string' && PRACTICES[r.practice] && typeof r.date==='string' && Number.isFinite(Date.parse(r.date))).map(r=>({
    id:r.id, practice:r.practice, date:r.date, mood:MOODS.some(m=>m.id===r.mood)?r.mood:null,
    anchor:ANCHORS[r.anchor]?r.anchor:'sound', note:String(r.note||'').slice(0,1200),
    answer:String(r.answer||'').slice(0,1200), inquiry:String(r.inquiry||'').slice(0,1200),
    reflection:String(r.reflection||'').slice(0,1600), takeaway:String(r.takeaway||'').slice(0,500),
    after:String(r.after||'').slice(0,100), practiceSeconds:Math.max(0,Number(r.practiceSeconds)||0),
  })).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
}
export function createRecord(session, date=new Date().toISOString()) {
  if(!PRACTICES[session.practice]) throw new Error('Unknown practice');
  return {id:session.id, date, practice:session.practice, mood:session.mood, anchor:session.anchor,
    note:session.note,answer:session.answer,inquiry:session.inquiry,reflection:session.reflection,
    takeaway:session.takeaway,after:session.after,practiceSeconds:Math.round(session.elapsed/1000)};
}
