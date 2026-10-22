import {test} from 'node:test';
import assert from 'node:assert/strict';
import {writeFile,readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {createTestLibrary} from '../helpers/library.ts';
import {importCatalog,importFiles} from '../../server/sources/import.ts';
import {listDossiers,saveDossier,getDossier} from '../../server/archive/repository.ts';
import {mergeDossiers,archiveDossier} from '../../server/archive/organize.ts';
import {listReviewItems} from '../../server/archive/facts.ts';
import {listSources,updateSource} from '../../server/sources/repository.ts';
import {enqueueExtraction,runPendingJobs} from '../../server/sources/jobs.ts';
import {readExtractedText,reviseExtractedText} from '../../server/sources/extract.ts';
import {migrate} from '../../server/db/migrations.ts';
import {transaction} from '../../server/db/transaction.ts';

async function catalog(ctx:any,records:any[],name='catalog.json') {
  for(const r of records)await writeFile(join(ctx.libraryRoot,r.archiveRel),'synthetic '+r.archiveRel);
  await writeFile(join(ctx.libraryRoot,name),JSON.stringify(records));
  return importCatalog(ctx,name);
}
function renamed(ctx:any,id:string,title:string) {const {revision,archivedAt,visitedAt,...input}=getDossier(ctx,id);return saveDossier(ctx,{...input,title},revision);}
const records=[{id:'a',archiveRel:'a.txt',category:'项目',subject:'Topic A'},{id:'b',archiveRel:'b.txt',category:'项目',subject:'Topic B'}];

for(const failingTable of ['dossiers','dossier_sources'])test(`a failed ${failingTable} insert rolls back the entire imported record and retry succeeds`,async t=>{
  const ctx=await createTestLibrary(t);
  await writeFile(join(ctx.libraryRoot,'a.txt'),'synthetic');await writeFile(join(ctx.libraryRoot,'catalog.json'),JSON.stringify([records[0]]));
  ctx.db.exec(`CREATE TEMP TRIGGER abort_dossier BEFORE INSERT ON ${failingTable} BEGIN SELECT RAISE(ABORT,'injected dossier failure'); END`);
  await assert.rejects(importCatalog(ctx,'catalog.json'),/injected dossier failure/);
  for(const table of ['sources','source_versions','origins','dossiers','catalog_topics','dossier_sources'])assert.equal(ctx.db.prepare(`SELECT count(*) n FROM ${table}`).get()!.n,0,table);
  ctx.db.exec('DROP TRIGGER abort_dossier');const report=await importCatalog(ctx,'catalog.json');
  assert.deepEqual(report.errors,[]);assert.equal(report.newSources,1);assert.equal(listDossiers(ctx,{}).length,1);
});

test('an unowned partial legacy origin can be recovered without duplicating its source',async t=>{
  const ctx=await createTestLibrary(t);await catalog(ctx,[records[0]]);const sourceId=listSources(ctx)[0].id;
  ctx.db.exec('DELETE FROM catalog_topics; DELETE FROM dossier_sources; DELETE FROM dossiers;');
  const report=await importCatalog(ctx,'catalog.json');assert.deepEqual(report.errors,[]);
  assert.equal(report.newSources,0);assert.equal(report.originCount,1);assert.equal(listSources(ctx,listDossiers(ctx,{})[0].id)[0].id,sourceId);
});

test('nested transactions use savepoints without committing or rolling back their caller',async t=>{
  const ctx=await createTestLibrary(t);
  transaction(ctx.db,()=>{
    ctx.db.prepare('INSERT INTO settings VALUES(?,?)').run('outer','kept');
    assert.throws(()=>transaction(ctx.db,()=>{ctx.db.prepare('INSERT INTO settings VALUES(?,?)').run('inner','removed');throw new Error('rollback inner');}),/rollback inner/);
    assert.equal(ctx.db.prepare('SELECT data FROM settings WHERE key=?').get('outer')!.data,'kept');
  });
  assert.equal(ctx.db.prepare('SELECT data FROM settings WHERE key=?').get('inner'),undefined);
  assert.throws(()=>transaction(ctx.db,()=>{transaction(ctx.db,()=>ctx.db.prepare('INSERT INTO settings VALUES(?,?)').run('nested','removed'));throw new Error('rollback outer');}),/rollback outer/);
  assert.equal(ctx.db.prepare('SELECT data FROM settings WHERE key=?').get('nested'),undefined);
});

test('equivalent Windows catalog separators preserve one dossier and one origin',async t=>{
  const ctx=await createTestLibrary(t);await mkdir(join(ctx.libraryRoot,'index'));
  await catalog(ctx,[records[0]],'index/catalog.json');
  const before=listDossiers(ctx,{})[0];const renamedDossier=renamed(ctx,before.id,'User title');archiveDossier(ctx,before.id,renamedDossier.revision);
  const report=await importCatalog(ctx,'index\\catalog.json');assert.deepEqual(report.errors,[]);
  assert.equal(report.originCount,1);assert.equal(ctx.db.prepare('SELECT count(*) n FROM dossiers').get()!.n,1);
  assert.equal(listDossiers(ctx,{}).length,0);
});

test('legacy backslash catalog hashes migrate to canonical ownership without duplicate origins',async t=>{
  const ctx=await createTestLibrary(t);await mkdir(join(ctx.libraryRoot,'index'));await catalog(ctx,[records[0]],'index/catalog.json');
  const hash=(s:string)=>createHash('sha256').update(s).digest('hex'),canonical=hash('index/catalog.json'),legacy=hash('index\\catalog.json');
  ctx.db.prepare('UPDATE catalog_topics SET catalog_key=? WHERE catalog_key=?').run(legacy,canonical);
  ctx.db.prepare("UPDATE origins SET id=? || substr(id,65) WHERE substr(id,1,64)=?").run(legacy,canonical);
  renamed(ctx,listDossiers(ctx,{})[0].id,'Edited owner');
  const report=await importCatalog(ctx,'index/catalog.json');assert.deepEqual(report.errors,[]);assert.equal(report.originCount,1);
  assert.equal(ctx.db.prepare('SELECT count(*) n FROM dossiers').get()!.n,1);
  assert.equal(ctx.db.prepare('SELECT catalog_key FROM catalog_topics').get()!.catalog_key,canonical);
});

test('conflicting legacy catalog aliases report ambiguity without changing either owner',async t=>{
  const ctx=await createTestLibrary(t);await mkdir(join(ctx.libraryRoot,'index'));await catalog(ctx,records,'index/catalog.json');
  const a=listDossiers(ctx,{}).find(d=>d.title==='Topic A')!,b=listDossiers(ctx,{}).find(d=>d.title==='Topic B')!;
  const legacy=createHash('sha256').update('index\\catalog.json').digest('hex');
  ctx.db.prepare('INSERT INTO catalog_topics VALUES(?,?,?)').run(legacy,JSON.stringify(['项目','Topic A']),b.id);
  const before=ctx.db.prepare('SELECT * FROM catalog_topics ORDER BY catalog_key,topic_key').all();
  const report=await importCatalog(ctx,'index\\catalog.json');assert.equal(report.errors[0]?.code,'AMBIGUOUS_TOPIC');
  assert.deepEqual(ctx.db.prepare('SELECT * FROM catalog_topics ORDER BY catalog_key,topic_key').all(),before);
  assert.equal(listDossiers(ctx,{}).length,2);assert.equal(listSources(ctx,a.id).length,1);
});

test('catalog import recognizes portfolio labels and explicit dossier kind codes',async t=>{
  const ctx=await createTestLibrary(t);const inputs=[
    {id:1,archiveRel:'a.txt',subject:'作品',category:'作品集'},
    {id:2,archiveRel:'b.txt',subject:'品牌',category:'个人品牌'},
    {id:3,archiveRel:'c.txt',subject:'机器码',category:'misc',dossierKind:'research'},
    {id:4,archiveRel:'d.txt',subject:'覆盖',category:'作品集',dossierKind:'reference'},
  ];await catalog(ctx,inputs);const byTitle=new Map(listDossiers(ctx,{}).map(d=>[d.title,d.kind]));
  assert.equal(byTitle.get('作品'),'portfolio');assert.equal(byTitle.get('品牌'),'portfolio');assert.equal(byTitle.get('机器码'),'research');assert.equal(byTitle.get('覆盖'),'reference');
});

test('re-import follows stable topics after rename, merge and archive',async t=>{
  const ctx=await createTestLibrary(t);await catalog(ctx,records);
  const a=listDossiers(ctx,{}).find(d=>d.title==='Topic A')!,b=listDossiers(ctx,{}).find(d=>d.title==='Topic B')!;
  const changed=renamed(ctx,a.id,'Renamed by user');await importCatalog(ctx,'catalog.json');
  assert.equal(listDossiers(ctx,{}).length,2,'rename must not create a second imported dossier');
  mergeDossiers(ctx,a.id,b.id,changed.revision,b.revision);archiveDossier(ctx,b.id,b.revision);
  await writeFile(join(ctx.libraryRoot,'c.txt'),'new synthetic source');
  await writeFile(join(ctx.libraryRoot,'catalog.json'),JSON.stringify([...records,{id:'c',archiveRel:'c.txt',category:'项目',subject:'Topic A'}]));
  const report=await importCatalog(ctx,'catalog.json');assert.equal(report.errors.length,0);
  assert.equal(listDossiers(ctx,{}).length,0,'archived topics must stay archived');
  assert.equal(ctx.db.prepare('SELECT count(*) n FROM dossiers').get()!.n,2);
  assert.equal(listSources(ctx,b.id).length,3,'new source must follow the merged topic owner');
});

test('catalog identity and raw category distinguish otherwise identical subjects',async t=>{
  const ctx=await createTestLibrary(t);
  await catalog(ctx,[{id:1,archiveRel:'a.txt',category:'项目/甲',subject:'Same'},{id:2,archiveRel:'b.txt',category:'项目/乙',subject:'Same'}]);
  await catalog(ctx,[{id:1,archiveRel:'c.txt',category:'项目/甲',subject:'Same'}],'other.json');
  assert.equal(listDossiers(ctx,{}).length,3);
  await importCatalog(ctx,'catalog.json');await importCatalog(ctx,'other.json');assert.equal(listDossiers(ctx,{}).length,3);
});

test('legacy import mapping backfills renamed, merged and archived ownership',async t=>{
  const ctx=await createTestLibrary(t);await catalog(ctx,records);
  const a=listDossiers(ctx,{}).find(d=>d.title==='Topic A')!,b=listDossiers(ctx,{}).find(d=>d.title==='Topic B')!;
  const changed=renamed(ctx,a.id,'Renamed before upgrade');mergeDossiers(ctx,a.id,b.id,changed.revision,b.revision);
  ctx.db.exec('DROP TABLE IF EXISTS catalog_topics; PRAGMA user_version=2');
  await migrate(ctx.db,ctx.runtimeRoot);
  // Migration must pick the live merge target even though the archived source retains its links.
  await importCatalog(ctx,'catalog.json');assert.equal(listDossiers(ctx,{}).length,1);
  assert.equal(ctx.db.prepare('SELECT count(*) n FROM dossiers').get()!.n,2);
  archiveDossier(ctx,b.id,b.revision);await importCatalog(ctx,'catalog.json');assert.equal(listDossiers(ctx,{}).length,0);
});

test('upload to an existing dossier creates no unrelated grouping',async t=>{
  const ctx=await createTestLibrary(t);await catalog(ctx,[records[0]]);const target=listDossiers(ctx,{})[0];
  async function* files(){yield{name:'new.txt',stream:[Buffer.from('synthetic upload')]};}
  const report=await importFiles(ctx,files(),target.id);
  assert.equal(listDossiers(ctx,{}).length,1);assert.equal(listSources(ctx,target.id).length,2);
  assert.equal((await readFile(join(ctx.libraryRoot,listSources(ctx,target.id).find(s=>s.id===report.sourceIds[0])!.relativePath),'utf8')),'synthetic upload');
  await assert.rejects(importFiles(ctx,files(),'missing-dossier'),{code:'NOT_FOUND'});
  assert.equal(ctx.db.prepare('SELECT count(*) n FROM sources').get()!.n,2);
  await importFiles(ctx,files());assert.equal(listDossiers(ctx,{}).length,2,'untargeted uploads retain their independent inbox');
});

test('ambiguous legacy ownership is reported without inventing another dossier',async t=>{
  const ctx=await createTestLibrary(t);await catalog(ctx,records);
  const a=listDossiers(ctx,{}).find(d=>d.title==='Topic A')!,b=listDossiers(ctx,{}).find(d=>d.title==='Topic B')!;
  // Both possible owners are retired and neither edited title identifies the topic.
  renamed(ctx,a.id,'Edited A');renamed(ctx,b.id,'Edited B');
  ctx.db.prepare('INSERT OR IGNORE INTO dossier_sources VALUES(?,?)').run(b.id,listSources(ctx,a.id)[0].id);
  archiveDossier(ctx,a.id,2);archiveDossier(ctx,b.id,2);
  ctx.db.exec('DROP TABLE catalog_topics; PRAGMA user_version=2');await migrate(ctx.db,ctx.runtimeRoot);
  const report=await importCatalog(ctx,'catalog.json');assert.equal(report.errors[0]?.code,'AMBIGUOUS_TOPIC');
  assert.equal(ctx.db.prepare('SELECT count(*) n FROM dossiers').get()!.n,2);assert.equal(listDossiers(ctx,{}).length,0);
});

test('legacy merged owners archived before upgrade are not inferred from obsolete titles',async t=>{
  const ctx=await createTestLibrary(t);await catalog(ctx,records);
  const a=listDossiers(ctx,{}).find(d=>d.title==='Topic A')!,b=listDossiers(ctx,{}).find(d=>d.title==='Topic B')!;
  mergeDossiers(ctx,a.id,b.id,a.revision,b.revision);archiveDossier(ctx,b.id,b.revision);
  ctx.db.exec('DROP TABLE catalog_topics; PRAGMA user_version=2');await migrate(ctx.db,ctx.runtimeRoot);
  const report=await importCatalog(ctx,'catalog.json');assert.equal(report.errors[0]?.code,'AMBIGUOUS_TOPIC');
  assert.equal(ctx.db.prepare('SELECT count(*) n FROM dossiers').get()!.n,2);assert.equal(listDossiers(ctx,{}).length,0);
});

test('reference review only reports applicable material issues',async t=>{
  const ctx=await createTestLibrary(t);await catalog(ctx,[{id:1,archiveRel:'a.txt',category:'参考',subject:'Reference'}]);
  const d=listDossiers(ctx,{})[0];assert.deepEqual(listReviewItems(ctx),[]);
  const s=listSources(ctx,d.id)[0];updateSource(ctx,{...s,extractionState:'failed'});
  assert.deepEqual(listReviewItems(ctx).map(item=>item.reasons),[['材料提取失败']]);
});

test('ordinary re-extraction preserves human corrections and their revision',async t=>{
  const ctx=await createTestLibrary(t);await catalog(ctx,[records[0]]);const s=listSources(ctx)[0];
  enqueueExtraction(ctx,s.id);await runPendingJobs(ctx,new AbortController().signal);
  const first=readExtractedText(ctx,s.id,1);reviseExtractedText(ctx,s.id,1,'Human correction',1);
  enqueueExtraction(ctx,s.id);await runPendingJobs(ctx,new AbortController().signal);
  assert.equal(readExtractedText(ctx,s.id,1).text,'Human correction');assert.equal(readExtractedText(ctx,s.id,1).revision,2);
  assert.equal(readExtractedText(ctx,s.id,1).originalText,first.originalText);
  assert.throws(()=>reviseExtractedText(ctx,s.id,1,'stale edit',1),{code:'CONFLICT'});
});

test('a manual correction committed while extraction runs survives worker completion',async t=>{
  const ctx=await createTestLibrary(t);await catalog(ctx,[records[0]]);const s=listSources(ctx)[0];
  enqueueExtraction(ctx,s.id);await runPendingJobs(ctx,new AbortController().signal);
  const j=enqueueExtraction(ctx,s.id),controller=new AbortController();
  const running=runPendingJobs(ctx,controller.signal);const deadline=Date.now()+5000;
  while(ctx.db.prepare('SELECT state FROM jobs WHERE id=?').get(j.id)!.state==='queued'&&Date.now()<deadline)await new Promise(r=>setTimeout(r,1));
  assert.equal(ctx.db.prepare('SELECT state FROM jobs WHERE id=?').get(j.id)!.state,'running');
  reviseExtractedText(ctx,s.id,1,'Correction while running',1);await running;
  assert.equal(ctx.db.prepare('SELECT state FROM jobs WHERE id=?').get(j.id)!.state,'ready');
  assert.equal(readExtractedText(ctx,s.id,1).text,'Correction while running');assert.equal(readExtractedText(ctx,s.id,1).revision,2);
});

test('a new original version gets fresh extraction without altering the older correction',async t=>{
  const ctx=await createTestLibrary(t);await catalog(ctx,[records[0]]);const s=listSources(ctx)[0];
  enqueueExtraction(ctx,s.id);await runPendingJobs(ctx,new AbortController().signal);reviseExtractedText(ctx,s.id,1,'Older correction',1);
  await writeFile(join(ctx.libraryRoot,'a.txt'),'Version two text');await importCatalog(ctx,'catalog.json');
  enqueueExtraction(ctx,s.id);await runPendingJobs(ctx,new AbortController().signal);
  assert.equal(readExtractedText(ctx,s.id,2).text,'Version two text');assert.equal(readExtractedText(ctx,s.id,2).revision,1);
  assert.equal(readExtractedText(ctx,s.id,1).text,'Older correction');assert.equal(readExtractedText(ctx,s.id,1).revision,2);
});
