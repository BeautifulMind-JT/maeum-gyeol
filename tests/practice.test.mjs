import test from 'node:test';
import assert from 'node:assert/strict';
import {TastingClock,STAGES,TOTAL_SECONDS,parseWineRecords} from '../dist/tasting.mjs';
import {parseRecords,escapeHtml} from '../dist/model.mjs';
test('mindfulness sequence, pause, replay and completion retain the automatic flow',()=>{
 const c=new TastingClock();c.resume(0);assert.equal(c.takeCue(),STAGES[0].cues[0].text);assert.equal(c.takeCue(),null);
 c.tick(26000);assert.equal(c.takeCue(),STAGES[0].cues[1].text);c.pause(30000);c.tick(100000);assert.equal(c.elapsed,30);
 c.replayCurrentCue();assert.equal(c.elapsed,22);c.resume(100000);assert.equal(c.takeCue(),STAGES[0].cues[1].text);
 c.next(100000);assert.equal(c.snapshot().stage,1);c.pause(100000);c.next(200000);assert.equal(c.running,false);
 c.resume(200000);c.tick(290000);assert.equal(c.snapshot().done,true);assert.ok(c.activeSeconds<TOTAL_SECONDS);
 const full=new TastingClock();full.resume(0);const cues=[];for(let t=0;t<=180000;t+=200){full.tick(t);const cue=full.takeCue();if(cue)cues.push(cue);}
 assert.equal(cues.length,8);assert.equal(full.snapshot().done,true);
});
test('legacy records remain readable and hostile text stays escaped',()=>{
 const old={id:'old',date:'2026-09-08T10:00:00Z',practice:'attention',note:'남겨둔 기록'};
 assert.equal(parseRecords(JSON.stringify([old]))[0].note,old.note);
 assert.equal(parseWineRecords(JSON.stringify([{id:'wine',date:old.date,note:'와인 기록',stage:'color'}]))[0].note,'와인 기록');
 assert.equal(escapeHtml('<script>'), '&lt;script&gt;');assert.throws(()=>parseWineRecords('{bad'));
});
test('login draft restoration retains wine identity and keeps older context separate',()=>{
 const pending={id:'draft',date:'2026-09-08T10:00:00Z',context:'창가에서',wineName:'도멘 테스트',vintage:'2021',note:'따뜻한 손을 알아차렸다.'};
 const restored=parseWineRecords(JSON.stringify([pending]))[0];
 for(const key of ['context','wineName','vintage','note'])assert.equal(restored[key],pending[key]);
 const older=parseWineRecords(JSON.stringify([{id:pending.id,date:pending.date,wine:'잠깐 멈춘 시간',note:pending.note}]))[0];
 assert.equal(older.context,'잠깐 멈춘 시간');assert.equal(older.wineName,'');assert.equal(older.vintage,'');
});
