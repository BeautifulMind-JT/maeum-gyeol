import test from 'node:test';
import assert from 'node:assert/strict';
import {createServerJournal} from '../mobile/src/server-journal.mjs';

const fresh=()=>({id:crypto.randomUUID(),date:'2026-09-14T00:00:00.000Z',note:'요청한 순간의 기록',wineName:'',vintage:'',context:'',stage:'finish',seconds:180,conversation:[{role:'you',text:'요청한 순간의 돌아보기'}]});
const clone=value=>structuredClone(value);
const serverRow=(value,revision=1)=>({
 id:value.id,created_at:value.date,updated_at:value.date,note:value.note,context:value.context,
 wine_name:value.wineName,vintage:value.vintage,stage:value.stage,seconds:value.seconds,
 conversation:clone(value.conversation),photo_path:value.photoPath||null,
 comments_enabled:value.commentsEnabled!==false,featured:value.featured===true,
 visibility:value.visibility||'private',deleted:value.deleted===true,revision,mutation_id:value.mutationId
});

// Deterministic transport stand-in: these tests exercise the production journal
// state machine, not Auth, PostgREST, SQL policies, or real device persistence.
function transport({draft=null,rows=[]}={}){
 let current=clone(draft);
 const entries=new Map(rows.map(r=>[r.id,clone(r)])),sentDrafts=[],sentEntries=[];
 return {
  sentDrafts,sentEntries,
  async loadDraft(){return clone(current);},
  async pull(){return clone([...entries.values()]);},
  async commitDraft(request){
   sentDrafts.push(clone(request));
   current={revision:(current?.revision||0)+1,mutation_id:request.mutationId,payload:clone(request.payload)};
   return {status:'applied',draft:clone(current)};
  },
  async save(value,draftRevision){
   sentEntries.push({record:clone(value),draftRevision});
   const row=serverRow(value,(entries.get(value.id)?.revision||0)+1);entries.set(row.id,row);
   if(draftRevision!==null)current={revision:draftRevision+1,payload:null};
   return {status:'applied',entry:clone(row),draft:clone(current)};
  }
 };
}

function editAfterSubmission(value){
 value.note='호출 뒤 변경된 기록';
 value.conversation[0].text='호출 뒤 변경된 돌아보기';
 value.visibility='public';
}

for(const operation of ['storeDraft','save','finish']){
 test(`${operation} captures its input before waiting in the serial queue`,async()=>{
  const value=fresh(),expected=clone(value);
  const remote=transport({draft:{revision:1,payload:{...clone(value),note:'서버에 있던 초기 초안'}}});
  const gate=Promise.withResolvers(),started=Promise.withResolvers();
  const load=remote.loadDraft;
  remote.loadDraft=async()=>{started.resolve();await gate.promise;return load();};
  const j=createServerJournal(remote);
  const reading=j.draft();await started.promise;
  const submitted=j[operation](value);
  editAfterSubmission(value);gate.resolve();await reading;
  const result=await submitted;
  assert.equal(result.note,expected.note);
  assert.deepEqual(result.conversation,expected.conversation);
  assert.equal(result.visibility,'private');
  if(operation==='storeDraft'){
   assert.equal(remote.sentDrafts.length,1);
   assert.equal(remote.sentDrafts[0].payload.note,expected.note);
  }else{
   assert.equal(remote.sentEntries.length,1);
   assert.equal(remote.sentEntries[0].record.note,expected.note);
  }
 });
}

test('list results cannot mutate the retained record used by a later visibility change',async()=>{
 const value=fresh(),remote=transport({rows:[serverRow(value)]}),j=createServerJournal(remote);
 const [shown]=await j.list();
 shown.note='저장을 요청하지 않은 편집';shown.conversation[0].text='공유를 요청하지 않은 변경';
 await j.publish(value.id,'public');
 assert.equal(remote.sentEntries[0].record.note,value.note);
 assert.deepEqual(remote.sentEntries[0].record.conversation,value.conversation);
 assert.equal(remote.sentEntries[0].record.visibility,'public');
});

test('sync reports unresolved writes instead of claiming that none remain',async()=>{
 const remote=transport(),j=createServerJournal({...remote,commitDraft:async()=>{throw Error('reply unavailable');},save:async()=>{throw Error('reply unavailable');}});
 await assert.rejects(j.storeDraft(fresh()),/reply unavailable/);
 await assert.rejects(j.save(fresh()),/reply unavailable/);
 const result=await j.sync();
 assert.equal(result.pending,2);
 assert.equal(result.pending,await j.pending());
 assert.equal(j.hasPending(),true);
 // A read-only refresh does not silently replay writes or dispose of them.
 assert.equal(remote.sentDrafts.length,0);assert.equal(remote.sentEntries.length,0);
});
