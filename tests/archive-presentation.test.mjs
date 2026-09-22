import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {escapeHtml} from '../dist/model.mjs';
import {STAGES} from '../dist/tasting.mjs';

const presentation=(await readFile(new URL('../mobile/src/presentation.mjs',import.meta.url),'utf8'))
 .replace(/^import .*;\r?\n/gm,'').replace(/^export \{.*\};\r?\n/gm,'').replace(/export /g,'');
const render=vm.runInNewContext(presentation+'\ndiaryRows;',{esc:escapeHtml,STAGES,Date,icon:()=>''});

test('diary groups by local month, keeps the day, and escapes record content',()=>{
 const timezone=process.env.TZ;process.env.TZ='Asia/Seoul';
 try{
  const rows=[
   {id:'a',date:'2026-01-31T16:00:00Z',context:'<script>alert(1)</script>',note:'A & B',stage:'finish',visibility:'private'},
   {id:'b',date:'2026-01-31T15:30:00Z',context:'둘째',note:'공개',stage:'finish',visibility:'public'},
   {id:'c',date:'2026-01-30T12:00:00Z',context:'셋째',stage:'finish',note:''},
  ];
  const html=render(rows);
  assert.equal((html.match(/class="diary-date"/g)||[]).length,2);
  assert.ok(html.includes('2026년 2월'));assert.ok(html.includes('2026년 1월'));
  assert.equal((html.match(/<strong>1<\/strong>/g)||[]).length,2);
  assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('A &amp; B'));assert.ok(html.includes('공개'));assert.ok(html.includes('나만'));
  assert.ok(html.includes('data-action="entry" data-id="a"'));
 }finally{if(timezone===undefined)delete process.env.TZ;else process.env.TZ=timezone;}
});

test('shared record and profile links use the canonical Pages host',async()=>{
 const source=(await readFile(new URL('../mobile/src/social-ui.mjs',import.meta.url),'utf8'))
  .replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
 const link=vm.runInNewContext(source+'\npublicLink;');
 assert.equal(link('post','a/b'),'https://maeum-gyeol.pages.dev/mobile/#post/a%2Fb');
 assert.equal(link('profile','person'),'https://maeum-gyeol.pages.dev/mobile/#profile/person');
});
