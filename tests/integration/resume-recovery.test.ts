import {test} from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {rm} from 'node:fs/promises';
import {createTestLibrary} from '../helpers/library.ts';
import {createLocalApp} from '../../server/app.ts';
import {createBackup,verifyBackup} from '../../server/backup/service.ts';
import {openLibrary,closeLibrary} from '../../server/db/database.ts';
import {libraryManifest} from '../../server/backup/manifest.ts';

const snapshot={draft:{roleTitle:'恢复测试',jobDescription:'',profileSelection:['name'],sections:[],selectedFactRevisions:{},editedText:{},targetPages:1},baseRevision:null,profileRevision:0,profileEdits:{name:'合成姓名',email:'unfinished@',phone:'',location:'',headline:''}};
test('resume recovery persists incomplete input separately and rejects concurrent stale changes',async t=>{
 const ctx=await createTestLibrary(t),app=await createLocalApp(ctx);await new Promise<void>(done=>app.server.listen(0,'127.0.0.1',done));t.after(()=>app.close());
 const url=`http://127.0.0.1:${(app.server.address() as any).port}`;
 assert.equal((await fetch(url+'/api/resume-recoveries')).status,401);
 const response=await fetch(url+'/api/session'),cookie=response.headers.get('set-cookie')!.split(';')[0],csrf=(await response.json()).data.csrf;
 const call=async(path:string,body?:unknown)=>{const r=await fetch(url+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{cookie,'x-csrf-token':csrf,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return{status:r.status,...await r.json()};};
 const created=await call('resume-recoveries',{input:snapshot,expectedRevision:null});assert.equal(created.status,200,JSON.stringify(created));assert.equal(created.data.revision,1);
 const {id}=created.data;
 assert.equal(ctx.db.prepare('SELECT count(*) n FROM resume_drafts').get()!.n,0);
 assert.equal(ctx.db.prepare('SELECT count(*) n FROM profile').get()!.n,0,'recovery must not save shared profile');
 const list=await call('resume-recoveries');assert.equal(list.data[0].id,id);assert.equal(list.data[0].roleTitle,'恢复测试');assert.equal(list.data[0].profileEdits,undefined,'list contains metadata only');
 assert.deepEqual((await call('resume-recoveries/'+id)).data.snapshot,snapshot);
 const updated=await call('resume-recoveries',{id,input:{...snapshot,draft:{...snapshot.draft,roleTitle:'新的输入'}},expectedRevision:1});assert.equal(updated.data.revision,2);
 assert.equal((await call('resume-recoveries',{id,input:snapshot,expectedRevision:1})).status,409);
 assert.equal((await call('resume-recoveries/'+id+'/discard',{expectedRevision:1})).status,409);
 assert.equal((await call('resume-recoveries/'+id)).data.snapshot.draft.roleTitle,'新的输入');
 assert.equal((await call('resume-recoveries',{input:{...snapshot,baseRevision:5},expectedRevision:null})).status,400,'new drafts cannot carry another saved revision');
 assert.equal((await call('resume-recoveries/'+id+'/discard',{expectedRevision:2})).status,200);
 assert.equal((await call('resume-recoveries/'+id)).status,404);
});

test('encrypted backups include recovery snapshots and verify pre-recovery-schema backups',async t=>{
 const ctx=await createTestLibrary(t);
 const backupRoot=ctx.libraryRoot+'-backups',oldRoot=ctx.libraryRoot+'-old-restored',currentRoot=ctx.libraryRoot+'-current-restored';
 t.after(async()=>{for(const root of [backupRoot,oldRoot,currentRoot])await rm(root,{recursive:true,force:true});});
 // Model a real schema-3 backup, which is verified before any migration is run.
 ctx.db.exec('DROP TABLE IF EXISTS resume_recoveries; PRAGMA user_version=3');
 const oldManifest=libraryManifest(ctx.db);assert.equal('resumeRecoveries' in oldManifest,false);
 const old=await createBackup(ctx,'synthetic-recovery-password',backupRoot);
 assert.equal(old.complete,true,JSON.stringify(old));
 const oldRestore=await verifyBackup(old.path!,'synthetic-recovery-password',oldRoot);assert.equal(oldRestore.validated,true,JSON.stringify(oldRestore));
 const restored=await openLibrary(oldRestore.newRoot!);try{
  const {saveResumeRecovery,listResumeRecoveries,getResumeRecovery}=await import('../../server/resume/recovery.ts');
  const recovery=saveResumeRecovery(restored,snapshot,null);assert.equal(listResumeRecoveries(restored).length,1);
  const report=await createBackup(restored,'synthetic-recovery-password',backupRoot);
  const checked=await verifyBackup(report.path!,'synthetic-recovery-password',currentRoot);assert.equal(checked.validated,true,JSON.stringify(checked));
  const copy=await openLibrary(checked.newRoot!);try{assert.deepEqual(getResumeRecovery(copy,recovery.id),recovery);assert.deepEqual(libraryManifest(copy.db),libraryManifest(restored.db));}finally{await closeLibrary(copy);}
 }finally{await closeLibrary(restored);}
});
