// Korean legal/support pages served as static files on the Pages deploy.
// Operator facts come from config/operator.json; unresolved {{...}} placeholders
// are rendered as clearly marked pending values, never as invented data.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isPlaceholder=value=>/^\{\{[A-Z0-9_]+\}\}$/.test(String(value??'').trim());
const field=value=>isPlaceholder(value)?`<mark class="pending" title="운영자 확정 전 항목">${esc(value)}</mark>`:esc(value);

export const CRISIS_LINES=[
 {name:'자살예방상담전화',number:'109',note:'24시간, 보건복지부'},
 {name:'정신건강위기상담전화',number:'1577-0199',note:'24시간, 전국'},
 {name:'긴급 신고(경찰)',number:'112',note:''},
 {name:'구조·구급(소방)',number:'119',note:''},
];
const crisisList=()=>`<ul class="crisis">${CRISIS_LINES.map(l=>`<li><a href="tel:${l.number.replace(/-/g,'')}">${l.number}</a> ${esc(l.name)}${l.note?` <small>${esc(l.note)}</small>`:''}</li>`).join('')}</ul>`;

function layout(title,body){
 return `<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>${esc(title)} · 마음결</title>
<style>
:root{color-scheme:light;--blue:#0864ad;--ink:#172536;--muted:#596675;--line:#dce3e9}
body{margin:0;font:16px/1.75 -apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:var(--ink);background:#fff;word-break:keep-all}
header{background:var(--blue);color:#fffaf0;padding:28px 20px}
header a{color:inherit;text-decoration:none;font-size:22px;letter-spacing:.08em}
main{max-width:720px;margin:0 auto;padding:28px 20px 60px}
h1{font-size:26px;line-height:1.5;font-weight:600;margin:.4em 0}
h2{font-size:19px;margin:1.8em 0 .5em}
p,li{font-size:15px;color:var(--ink)}
ul{padding-left:22px}
table{border-collapse:collapse;width:100%;font-size:14px}
th,td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}
a{color:var(--blue)}
small,.muted{color:var(--muted)}
mark.pending{background:#fff3bf;border:1px dashed #d9a700;padding:0 4px;border-radius:3px;font-family:ui-monospace,monospace;font-size:13px}
nav.policy-nav{display:flex;gap:16px;flex-wrap:wrap;border-top:1px solid var(--line);margin-top:40px;padding-top:16px;font-size:14px}
ul.crisis{list-style:none;padding:0}
ul.crisis li{border:1px solid var(--line);border-radius:4px;padding:10px 14px;margin:8px 0}
ul.crisis a{font-weight:700;font-size:17px;margin-right:8px}
</style></head><body>
<header><a href="/mobile/">마음결</a></header>
<main>
${body}
<nav class="policy-nav"><a href="/terms/">이용약관</a><a href="/privacy/">개인정보처리방침</a><a href="/support/">지원·문의</a><a href="/mobile/">앱으로 돌아가기</a></nav>
</main></body></html>
`;
}

export function policyPages(operator){
 const o=operator,retention=o.retention||{};
 const operatorTable=`<table>
<tr><th>운영자</th><td>${field(o.operatorName)}</td></tr>
<tr><th>연락처 이메일</th><td>${field(o.contactEmail)}</td></tr>
<tr><th>주소</th><td>${field(o.address)}</td></tr>
<tr><th>개인정보 보호책임자</th><td>${field(o.privacyOfficer)}</td></tr>
</table>`;

 const terms=layout('이용약관',`
<p class="muted">시행일: ${field(o.effectiveDate)}</p>
<h1>마음결 이용약관</h1>
<p>이 약관은 ${field(o.operatorName)}(이하 “운영자”)이 제공하는 마음챙김 연습·기록 서비스 ‘마음결’(웹과 iOS·Android 앱, 이하 “서비스”)의 이용 조건을 정합니다. 서비스에 가입하거나 콘텐츠를 공개하려면 이 약관에 동의해야 합니다.</p>

<h2>1. 서비스 내용</h2>
<ul>
<li>마음챙김 연습 안내, 개인 기록(글·사진)의 저장과 열람.</li>
<li>사용자가 선택한 기록의 공개, 공개 기록의 발견·댓글·좋아요·팔로우.</li>
<li>기록은 기본값이 비공개이며, 공개 여부는 사용자가 선택하고 언제든 철회할 수 있습니다.</li>
</ul>

<h2>2. 계정</h2>
<ul>
<li>연습은 로그인 없이 사용할 수 있고, 기록 저장과 공개 활동에는 계정이 필요합니다.</li>
<li>계정은 이메일 인증으로 생성됩니다. 본인의 이메일만 사용해야 합니다.</li>
<li>앱의 계정 화면에서 언제든 계정과 모든 기록·사진을 직접 삭제할 수 있습니다.</li>
</ul>

<h2>3. 사용자 제작 콘텐츠(UGC)와 커뮤니티 규칙</h2>
<p><strong>마음결은 불쾌감을 주거나 타인을 해치는 콘텐츠를 허용하지 않습니다(무관용 원칙).</strong> 공개 기록·댓글·프로필 등 다른 사용자에게 보이는 모든 콘텐츠에 적용됩니다.</p>
<ul>
<li>금지: 불법 콘텐츠, 타인 비방·괴롭힘·혐오 표현, 음란물, 폭력·자해를 조장하는 내용, 스팸·광고 도배, 타인의 개인정보 노출, 지식재산권 침해.</li>
<li>모든 공개 기록과 댓글에는 <strong>신고</strong> 기능이, 모든 사용자에게는 <strong>차단</strong> 기능이 제공됩니다. 차단하면 해당 사용자의 콘텐츠와 반응이 내 화면에서 숨겨집니다.</li>
<li>접수된 신고는 <strong>24시간 이내에 검토</strong>하며, 규칙을 위반한 콘텐츠는 삭제하고 작성자에게는 경고·이용 제한·계정 퇴출 조치를 합니다.</li>
<li>콘텐츠를 공개하면 다른 사용자가 서비스 안에서 이를 읽고 반응하는 데 필요한 범위의 이용을 허락한 것으로 봅니다. 공개를 철회하면 서비스는 공개 사본과 그 댓글·좋아요를 삭제합니다.</li>
</ul>

<h2>4. 의료 서비스가 아님</h2>
<p>마음결은 마음챙김 연습과 기록을 돕는 도구이며, <strong>의료·심리상담 서비스가 아닙니다.</strong> 진단·치료·전문 상담을 대체할 수 없습니다. 위기 상황에서는 아래 연락처로 즉시 도움을 요청해주세요.</p>
${crisisList()}

<h2>5. 서비스 변경과 책임</h2>
<ul>
<li>운영자는 서비스의 내용을 개선하거나 변경할 수 있으며, 중요한 변경은 서비스 안에서 알립니다.</li>
<li>운영자는 사용자가 공개한 콘텐츠의 내용에 대해 사전 검열 의무를 지지 않으나, 신고 접수 시 이 약관에 따라 조치합니다.</li>
<li>약관을 위반한 계정의 이용을 제한하거나 종료할 수 있습니다.</li>
</ul>

<h2>6. 문의와 분쟁</h2>
<p>약관에 관한 문의는 ${field(o.contactEmail)}로 보내주세요. 이 약관은 대한민국 법률을 따릅니다.</p>
${operatorTable}
`);

 const privacy=layout('개인정보처리방침',`
<p class="muted">시행일: ${field(o.effectiveDate)}</p>
<h1>마음결 개인정보처리방침</h1>
<p>${field(o.operatorName)}(이하 “운영자”)은 ‘마음결’ 서비스에서 다음과 같이 개인정보를 처리합니다.</p>

<h2>1. 수집하는 정보와 목적</h2>
<table>
<tr><th>항목</th><th>수집 시점</th><th>목적</th></tr>
<tr><td>이메일 주소</td><td>계정 가입·로그인(이메일 인증)</td><td>계정 식별, 로그인, 필수 안내</td></tr>
<tr><td>닉네임·소개</td><td>프로필 작성 시(선택)</td><td>공개 활동에서의 표시 이름</td></tr>
<tr><td>기록·사진</td><td>사용자가 직접 작성·첨부</td><td>개인 기록 보관, 사용자가 선택한 경우에만 공개</td></tr>
<tr><td>신고·차단 내역</td><td>해당 기능 사용 시</td><td>커뮤니티 보호와 분쟁 처리</td></tr>
</table>
<p>연습 기능은 로그인과 개인정보 수집 없이 사용할 수 있습니다. 광고 식별자나 행태 추적 도구는 사용하지 않습니다.</p>

<h2>2. 저장 방식과 보호</h2>
<ul>
<li>기록·사진·초안은 사용자의 계정에만 연결되어 서버(데이터베이스·비공개 저장소)에 저장되며, 소유자 외 접근은 데이터베이스 접근 규칙(RLS)으로 차단됩니다.</li>
<li>사진은 업로드 시 위치 정보 등 메타데이터(EXIF)를 제거한 뒤 저장합니다.</li>
<li>기록은 기본 비공개입니다. 사용자가 공개를 선택한 필드만 공개 사본으로 복사되며, 개인 돌아보기 대화는 공개되지 않습니다.</li>
<li>공개를 철회하면 공개 사본·댓글·좋아요·관련 소식을 삭제하고 사진 접근을 철회합니다.</li>
</ul>

<h2>3. 처리 위탁과 제3자 제공</h2>
<p>개인정보를 판매하지 않으며, 법령에 따른 경우를 제외하고 제3자에게 제공하지 않습니다. 서비스 운영을 위해 다음 처리자를 이용합니다.</p>
<table>
<tr><th>수탁자</th><th>업무</th></tr>
<tr><td>Supabase</td><td>인증(이메일 인증), 데이터베이스, 사진 저장소</td></tr>
<tr><td>Cloudflare</td><td>웹 앱과 이 안내 페이지의 정적 호스팅</td></tr>
</table>

<h2>4. 보유 기간과 파기</h2>
<ul>
<li>계정·기록·사진·프로필: <strong>사용자가 계정을 삭제할 때까지</strong> 보관합니다. 앱의 계정 화면에서 직접 삭제할 수 있으며, 삭제 시 사진과 모든 기록·댓글이 함께 삭제됩니다.</li>
<li>서비스 운영 로그: ${field(retention.serviceLogs)} 보관 후 파기합니다.</li>
<li>신고 처리 기록: ${field(retention.reportRecords)} 보관 후 파기합니다.</li>
<li>법령이 별도 보관을 요구하는 정보는 해당 법령이 정한 기간을 따릅니다.</li>
</ul>

<h2>5. 이용자의 권리</h2>
<ul>
<li>앱 안에서 본인의 기록·사진·프로필을 직접 열람·수정·삭제할 수 있고, 공개를 철회할 수 있습니다.</li>
<li>계정 삭제는 앱의 계정 화면에서 즉시 실행할 수 있으며, 처리 결과에 관한 문의는 아래 연락처로 할 수 있습니다.</li>
</ul>

<h2>6. 개인정보 보호책임자와 문의</h2>
${operatorTable}
<p>개인정보 관련 문의·열람·정정·삭제 요청은 ${field(o.contactEmail)}로 보내주세요. 지체 없이, 늦어도 관련 법령이 정한 기간 안에 답변합니다.</p>
`);

 const support=layout('지원·문의',`
<h1>마음결 지원·문의</h1>
<p>서비스 이용 중 궁금한 점이나 문제가 있다면 아래 연락처로 알려주세요.</p>
${operatorTable}
<p>문의 이메일: ${field(o.contactEmail)} <small>영업일 기준 가능한 한 빠르게 답변합니다.</small></p>

<h2>신고와 차단</h2>
<ul>
<li>공개 기록 화면의 <strong>신고</strong> 버튼으로 문제가 되는 콘텐츠를 신고할 수 있습니다.</li>
<li>프로필 화면의 <strong>차단</strong> 버튼으로 특정 사용자의 콘텐츠와 반응을 숨길 수 있습니다.</li>
<li>접수된 신고는 <strong>24시간 이내에 검토</strong>하고, 커뮤니티 규칙(불쾌한 콘텐츠 무관용)을 위반한 콘텐츠는 삭제하며 작성자에게 경고·이용 제한·퇴출 조치를 합니다.</li>
<li>앱에서 신고하기 어렵다면 위 이메일로 해당 기록의 공개 링크와 함께 알려주세요.</li>
</ul>

<h2>계정과 데이터</h2>
<ul>
<li>계정 삭제: 앱 → 계정 화면 → <strong>계정 삭제</strong>. 모든 기록·사진·댓글이 함께 삭제됩니다.</li>
<li>공개 철회: 기록 상세 화면에서 <strong>나만 보기로 전환</strong>을 누르면 공개 사본과 반응이 삭제됩니다.</li>
</ul>

<h2>위기 상황 안내</h2>
<p>마음결은 의료·심리상담 서비스가 아닙니다. 마음이 많이 힘들거나 위급한 상황이라면 지금 바로 전문 기관과 연결해주세요.</p>
${crisisList()}
`);

 return [
  {path:'terms/index.html',html:terms},
  {path:'privacy/index.html',html:privacy},
  {path:'support/index.html',html:support},
 ];
}
