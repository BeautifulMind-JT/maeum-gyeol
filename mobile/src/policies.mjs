// Public policy/support pages and the crisis notice shared by web and native shells.
// Numbers verified 2026-10 against mohw.go.kr / 129.go.kr: 109 replaced 1393 on
// 2024-01-01; 1577-0199 remains the nationwide mental-health crisis line.
const SITE_ORIGIN='https://maeum-gyeol.pages.dev';
export const POLICY_URLS={
 terms:SITE_ORIGIN+'/terms/',
 privacy:SITE_ORIGIN+'/privacy/',
 support:SITE_ORIGIN+'/support/',
};
export const CRISIS_LINES=[
 {name:'자살예방상담전화',number:'109',note:'24시간'},
 {name:'정신건강위기상담전화',number:'1577-0199',note:'24시간'},
 {name:'긴급 신고(경찰)',number:'112',note:''},
 {name:'구조·구급(소방)',number:'119',note:''},
];
export function crisisNoticeMarkup(){
 return '<p>마음결은 마음챙김 연습과 기록을 돕는 앱이에요. <strong>의료·심리상담 서비스가 아니며</strong>, 진단이나 치료, 전문 상담을 대신할 수 없어요.</p><p>마음이 많이 힘들거나 위기 상황이라면 지금 바로 전문가와 연결해주세요.</p><ul class="crisis-lines">'
  +CRISIS_LINES.map(l=>'<li><a href="tel:'+l.number.replace(/-/g,'')+'">'+l.number+'</a><span>'+l.name+(l.note?' · '+l.note:'')+'</span></li>').join('')
  +'</ul>';
}
