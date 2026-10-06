import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {policyPages,CRISIS_LINES} from '../scripts/policy-pages.mjs';

const operator=JSON.parse(await readFile(new URL('../config/operator.json',import.meta.url),'utf8'));

test('policy pages carry the review-required commitments in Korean',()=>{
 const pages=policyPages(operator),byPath=Object.fromEntries(pages.map(p=>[p.path,p.html]));
 assert.deepEqual(Object.keys(byPath).sort(),['privacy/index.html','support/index.html','terms/index.html']);
 for(const html of Object.values(byPath)){
  assert.match(html,/<html lang="ko">/);
  assert.match(html,/이용약관.*개인정보처리방침.*지원·문의/s,'cross navigation between the three pages');
 }
 const terms=byPath['terms/index.html'];
 assert.match(terms,/무관용/,'zero tolerance for objectionable content');
 assert.match(terms,/24시간 이내에 검토/,'reports acted on within 24 hours');
 assert.match(terms,/신고/) ;assert.match(terms,/차단/);
 assert.match(terms,/의료·심리상담 서비스가 아닙니다/);
 const privacy=byPath['privacy/index.html'];
 assert.match(privacy,/계정을 삭제할 때까지/,'retention tied to in-app account deletion');
 assert.match(privacy,/Supabase/);assert.match(privacy,/EXIF/);
 const support=byPath['support/index.html'];
 assert.match(support,/24시간 이내에 검토/);
 for(const line of CRISIS_LINES)assert.ok(support.includes(line.number),'crisis line '+line.number);
 assert.ok(support.includes('109')&&support.includes('1577-0199')&&support.includes('112')&&support.includes('119'));
});

test('unresolved operator placeholders stay visibly marked instead of inventing values',()=>{
 const pages=policyPages(operator);
 for(const page of pages){
  for(const match of page.html.matchAll(/\{\{[A-Z0-9_]+\}\}/g))assert.ok(page.html.includes('<mark class="pending"'),match[0]+' must be marked pending in '+page.path);
  assert.ok(!/undefined|null<\//.test(page.html),'no leaked empty operator fields in '+page.path);
 }
});

test('confirmed operator values replace the placeholders verbatim and escaped',()=>{
 const confirmed={operatorName:'홍길동<스튜디오>',contactEmail:'help@example.com',address:'서울시 어딘가 1-2',privacyOfficer:'홍길동',effectiveDate:'2026-10-10',retention:{serviceLogs:'3개월',reportRecords:'1년'}};
 for(const page of policyPages(confirmed)){
  assert.ok(!page.html.includes('{{'),'no placeholder survives in '+page.path);
  assert.ok(!page.html.includes('<mark class="pending"'),'no pending marker with confirmed values');
 }
 const terms=policyPages(confirmed).find(p=>p.path==='terms/index.html').html;
 assert.ok(terms.includes('홍길동&lt;스튜디오&gt;'),'operator name is HTML-escaped');
 assert.ok(terms.includes('help@example.com'));
});
