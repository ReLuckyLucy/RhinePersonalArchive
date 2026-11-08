import {test} from 'node:test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {LibraryContext} from '../../server/db/database.ts';
import type {Fact} from '../../shared/domain.ts';
import {factInput} from '../../shared/schemas.ts';
import {createTestLibrary} from '../helpers/library.ts';
import {seedConfirmed} from '../helpers/seed.ts';
import {saveDossier} from '../../server/archive/repository.ts';
import {saveFact,confirmFact,getFactHistory} from '../../server/archive/facts.ts';
import {saveResumeDraft,buildResumeDocument,freezeResumeVersion,getResumeVersion} from '../../server/resume/service.ts';

const unknown={value:null,precision:'unknown'};

function inputFrom(fact:Fact,fields:Record<string,unknown>):Record<string,unknown>{
  return {dossierId:fact.dossierId,text:fact.text,ownership:fact.ownership,metrics:fact.metrics,fieldValues:fields,evidenceLinks:fact.evidenceLinks};
}
function draftFor(ctx:LibraryContext,facts:Fact[],separateSections=false){
  return saveResumeDraft(ctx,{roleTitle:'合成测试岗位',jobDescription:'',profileSelection:['name'],sections:separateSections?facts.map((f,i)=>({title:'项目'+i,factIds:[f.id]})):[{title:'项目经历',factIds:facts.map(f=>f.id)}],selectedFactRevisions:Object.fromEntries(facts.map(f=>[f.id,f.revision])),editedText:{},targetPages:1},null);
}
async function confirmedWith(ctx:LibraryContext,base:Fact,fields:Record<string,unknown>){
  const saved=saveFact(ctx,base.dossierId,inputFrom(base,fields),null);
  return confirmFact(ctx,saved.id,saved.revision);
}

test('the ongoing fact field accepts explicit booleans without allowing booleans for other fields',async t=>{
  const ctx=await createTestLibrary(t),{fact}=await seedConfirmed(ctx);
  for(const ongoing of [true,false])assert.equal(factInput.safeParse(inputFrom(fact,{'dateRange.ongoing':ongoing})).success,true);
  for(const fields of [{title:true},{role:false},{'typedDetails.technologies':true},{'dateRange.start':true},{'dateRange.ongoing':'true'},{'dateRange.ongoing':[]}]){
    assert.equal(factInput.safeParse(inputFrom(fact,fields)).success,false,JSON.stringify(fields));
  }
});

test('ongoing dates reach a resume only after the fact is explicitly confirmed',async t=>{
  const ctx=await createTestLibrary(t),{fact}=await seedConfirmed(ctx);
  const saved=saveFact(ctx,fact.dossierId,inputFrom(fact,{...fact.fieldValues,'dateRange.ongoing':true}),null);
  assert.equal(saved.status,'draft');
  assert.equal(saved.confirmedAt,null);
  assert.ok(buildResumeDocument(ctx,draftFor(ctx,[saved]).id).issues.some(i=>i.level==='blocking'));
  const confirmed=await confirmFact(ctx,saved.id,saved.revision);
  assert.equal(confirmed.fieldValues['dateRange.ongoing'],true);
  const draft=draftFor(ctx,[confirmed]),built=buildResumeDocument(ctx,draft.id);
  assert.deepEqual(built.issues.filter(i=>i.level==='blocking'),[]);
  assert.equal(built.document.sections[0].items[0].date,'2024 — 至今');
  const version=await freezeResumeVersion(ctx,draft.id,draft.revision);
  assert.equal(version.document.sections[0].items[0].date,'2024 — 至今');
});

test('ongoing confirmation retains evidence assessment and original hash checks',async t=>{
  const ctx=await createTestLibrary(t),{fact,source}=await seedConfirmed(ctx);
  const fields={...fact.fieldValues,'dateRange.ongoing':true};
  const missing=saveFact(ctx,fact.dossierId,{...inputFrom(fact,fields),evidenceLinks:[]},null);
  await assert.rejects(confirmFact(ctx,missing.id,missing.revision),{code:'EVIDENCE_REQUIRED'});
  const unassessed=saveFact(ctx,fact.dossierId,{...inputFrom(fact,fields),evidenceLinks:fact.evidenceLinks.map(e=>({...e,grade:'unassessed'}))},null);
  await assert.rejects(confirmFact(ctx,unassessed.id,unassessed.revision),{code:'EVIDENCE_REQUIRED'});
  const changed=saveFact(ctx,fact.dossierId,inputFrom(fact,fields),null);
  await writeFile(join(ctx.libraryRoot,source.relativePath),'changed synthetic evidence');
  await assert.rejects(confirmFact(ctx,changed.id,changed.revision),{code:'SOURCE_CHANGED'});
});

test('confirmed ongoing dates preserve year month day and unknown start precision',async t=>{
  const ctx=await createTestLibrary(t),{fact}=await seedConfirmed(ctx);
  const cases=[
    {start:{value:'2024',precision:'year'},want:'2024 — 至今'},
    {start:{value:'2024-06',precision:'month'},want:'2024-06 — 至今'},
    {start:{value:'2024-06-18',precision:'day'},want:'2024-06-18 — 至今'},
    {start:unknown,want:'至今'},
  ];
  for(const {start,want} of cases){
    const confirmed=await confirmedWith(ctx,fact,{'dateRange.start':start,'dateRange.ongoing':true});
    const draft=draftFor(ctx,[confirmed]);
    assert.equal(buildResumeDocument(ctx,draft.id).document.sections[0].items[0].date,want);
  }
});

test('legacy confirmed facts never inherit ongoing status from the live dossier',async t=>{
  const ctx=await createTestLibrary(t),{fact,dossier}=await seedConfirmed(ctx);
  const {revision,archivedAt,visitedAt,...input}=dossier;
  saveDossier(ctx,{...input,dateRange:{...dossier.dateRange,ongoing:true}},revision);
  const draft=draftFor(ctx,[fact]);
  assert.equal(buildResumeDocument(ctx,draft.id).document.sections[0].items[0].date,'2024');
  const frozen=await freezeResumeVersion(ctx,draft.id,draft.revision);
  assert.equal(frozen.document.sections[0].items[0].date,'2024');
  assert.equal('dateRange.ongoing' in frozen.facts[0].fieldValues,false);
});

test('confirmed false keeps the confirmed end date when the dossier is ongoing',async t=>{
  const ctx=await createTestLibrary(t),{fact,dossier}=await seedConfirmed(ctx);
  const confirmed=await confirmedWith(ctx,fact,{...fact.fieldValues,'dateRange.end':{value:'2025-06',precision:'month'},'dateRange.ongoing':false});
  const {revision,archivedAt,visitedAt,...input}=dossier;
  saveDossier(ctx,{...input,dateRange:{...dossier.dateRange,ongoing:true}},revision);
  const draft=draftFor(ctx,[confirmed]);
  assert.equal(buildResumeDocument(ctx,draft.id).document.sections[0].items[0].date,'2024 — 2025-06');
  assert.deepEqual(buildResumeDocument(ctx,draft.id).issues.filter(i=>i.level==='blocking'),[]);
});

test('revising ongoing proof ignores an unselected end date later added to the live dossier',async t=>{
  const ctx=await createTestLibrary(t),{fact,dossier}=await seedConfirmed(ctx);
  const ongoing=await confirmedWith(ctx,fact,{...fact.fieldValues,'dateRange.ongoing':true});
  const {revision,archivedAt,visitedAt,...input}=dossier;
  saveDossier(ctx,{...input,dateRange:{start:{value:'2025',precision:'year'},end:{value:'2026',precision:'year'},ongoing:false}},revision);
  const revised=saveFact(ctx,ongoing.dossierId,{...inputFrom(ongoing,ongoing.fieldValues),id:ongoing.id},ongoing.revision);
  assert.equal(revised.status,'review');
  assert.equal('dateRange.end' in revised.fieldValues,false);
  const confirmed=await confirmFact(ctx,revised.id,revised.revision);
  assert.equal(buildResumeDocument(ctx,draftFor(ctx,[confirmed]).id).document.sections[0].items[0].date,'2024 — 至今');
});

test('revising legacy end-date proof ignores unselected ongoing status of the live dossier',async t=>{
  const ctx=await createTestLibrary(t),{fact,dossier}=await seedConfirmed(ctx);
  const ended=await confirmedWith(ctx,fact,{...fact.fieldValues,'dateRange.end':{value:'2025-06',precision:'month'}});
  const {revision,archivedAt,visitedAt,...input}=dossier;
  saveDossier(ctx,{...input,dateRange:{...dossier.dateRange,ongoing:true}},revision);
  const revised=saveFact(ctx,ended.dossierId,{...inputFrom(ended,ended.fieldValues),id:ended.id},ended.revision);
  assert.equal(revised.status,'review');
  assert.equal('dateRange.ongoing' in revised.fieldValues,false,'validation defaults must never become proof fields');
  const confirmed=await confirmFact(ctx,revised.id,revised.revision);
  assert.equal(buildResumeDocument(ctx,draftFor(ctx,[confirmed]).id).document.sections[0].items[0].date,'2024 — 2025-06');
});

test('a single fact cannot assert both ongoing and a known end date',async t=>{
  const ctx=await createTestLibrary(t),{fact}=await seedConfirmed(ctx);
  assert.throws(()=>saveFact(ctx,fact.dossierId,inputFrom(fact,{'dateRange.ongoing':true,'dateRange.end':{value:'2025',precision:'year'}}),null));
  assert.equal(ctx.db.prepare('SELECT count(*) n FROM facts').get()!.n,1);
});

test('conflicting confirmed end and ongoing evidence blocks freezing across selected sections',async t=>{
  const ctx=await createTestLibrary(t),{fact}=await seedConfirmed(ctx);
  const ended=await confirmedWith(ctx,fact,{'dateRange.end':{value:'2025',precision:'year'}});
  const ongoing=await confirmedWith(ctx,fact,{'dateRange.ongoing':true});
  for(const separateSections of [false,true]){
    const draft=draftFor(ctx,[ended,ongoing],separateSections);
    assert.ok(buildResumeDocument(ctx,draft.id).issues.some(i=>i.level==='blocking'&&/结束|进行中/.test(i.message)));
    await assert.rejects(freezeResumeVersion(ctx,draft.id,draft.revision),{code:'RESUME_BLOCKED'});
  }
});

test('conflicting confirmed ongoing booleans cannot be hidden in separate resume sections',async t=>{
  const ctx=await createTestLibrary(t),{fact}=await seedConfirmed(ctx);
  const ongoing=await confirmedWith(ctx,fact,{'dateRange.ongoing':true});
  const notOngoing=await confirmedWith(ctx,fact,{'dateRange.ongoing':false});
  const draft=draftFor(ctx,[ongoing,notOngoing],true);
  assert.ok(buildResumeDocument(ctx,draft.id).issues.some(i=>i.level==='blocking'&&/进行中/.test(i.message)));
  await assert.rejects(freezeResumeVersion(ctx,draft.id,draft.revision),{code:'RESUME_BLOCKED'});
});

test('adding ongoing requires renewed confirmation and leaves historical frozen resumes unchanged',async t=>{
  const ctx=await createTestLibrary(t),{fact}=await seedConfirmed(ctx);
  const oldDraft=draftFor(ctx,[fact]),oldVersion=await freezeResumeVersion(ctx,oldDraft.id,oldDraft.revision);
  const before=structuredClone(oldVersion);
  const revised=saveFact(ctx,fact.dossierId,{...inputFrom(fact,{...fact.fieldValues,'dateRange.ongoing':true}),id:fact.id},fact.revision);
  assert.equal(revised.status,'review');
  assert.equal(revised.confirmedAt,null);
  assert.ok(buildResumeDocument(ctx,draftFor(ctx,[revised]).id).issues.some(i=>i.level==='blocking'));
  const reconfirmed=await confirmFact(ctx,revised.id,revised.revision),newDraft=draftFor(ctx,[reconfirmed]);
  const newVersion=await freezeResumeVersion(ctx,newDraft.id,newDraft.revision);
  assert.equal(newVersion.document.sections[0].items[0].date,'2024 — 至今');
  assert.deepEqual(getResumeVersion(ctx,oldVersion.id),before);
  assert.equal(getFactHistory(ctx,fact.id)[1].fieldValues['dateRange.ongoing'],undefined);
});
