import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createTestLibrary} from '../helpers/library.ts';
import {saveDossier} from '../../server/archive/repository.ts';
import {importFiles} from '../../server/sources/import.ts';
import {getSource,updateSource} from '../../server/sources/repository.ts';
import {createLocalApp} from '../../server/app.ts';

const unknown={value:null,precision:'unknown'} as const;
const input={kind:'project',title:'合成进度测试',aliases:[],dateRange:{start:unknown,end:unknown,ongoing:false},organization:'',role:'',summary:'',skills:[],typedDetails:{},favorite:false} as const;
test('extraction snapshot counts current materials once and ignores old job versions without writes',async t=>{
 const ctx=await createTestLibrary(t),a=saveDossier(ctx,input,null),b=saveDossier(ctx,{...input,title:'第二份合成档案'},null);
 const shared=await importFiles(ctx,[{name:'shared.txt',stream:[Buffer.from('shared proof')]}],a.id);
 await importFiles(ctx,[{name:'shared.txt',stream:[Buffer.from('shared proof')]}],b.id);
 const failed=await importFiles(ctx,[{name:'failed.txt',stream:[Buffer.from('failed proof')]}],b.id);
 const s=getSource(ctx,shared.sourceIds[0]);updateSource(ctx,{...s,version:2,extractionState:'ready'});
 const put=(sourceId:string,version:number,state:string,error?:string)=>{const j={id:randomUUID(),sourceId,version,state,error};ctx.db.prepare('INSERT INTO jobs VALUES(?,?,?,?,?)').run(j.id,sourceId,version,state,JSON.stringify(j));};
 put(s.id,1,'failed','TIMEOUT');put(s.id,2,'failed','LIMIT');put(s.id,2,'ready');
 updateSource(ctx,{...getSource(ctx,failed.sourceIds[0]),extractionState:'failed'});put(failed.sourceIds[0],1,'failed','TIMEOUT');
 const app=await createLocalApp(ctx);await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));
 try{
  const url=`http://127.0.0.1:${(app.server.address() as any).port}`;
  assert.equal((await fetch(url+'/api/extraction-status')).status,401);
  const session=await fetch(url+'/api/session'),cookie=session.headers.get('set-cookie')!.split(';')[0];
  const before=ctx.db.prepare('SELECT total_changes() n').get()!.n;
  const res=await fetch(url+'/api/extraction-status',{headers:{cookie}});assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'no-store');
  const all=(await res.json()).data;assert.equal(all.total,2);assert.deepEqual(all.counts,{pending:0,queued:0,running:0,ready:1,failed:1,unsupported:0});
  assert.equal(all.materials.find((m:any)=>m.id===s.id).errorCode,undefined);
  assert.equal(all.materials.find((m:any)=>m.id===failed.sourceIds[0]).errorCode,'TIMEOUT');
  const scoped=(await(await fetch(url+`/api/extraction-status?dossierId=${a.id}`,{headers:{cookie}})).json()).data;assert.equal(scoped.total,1);assert.equal(scoped.counts.ready,1);
  assert.equal((await fetch(url+`/api/extraction-status?dossierId=${randomUUID()}`,{headers:{cookie}})).status,404);
  assert.equal(ctx.db.prepare('SELECT total_changes() n').get()!.n,before);
 }finally{await app.close();}
});

test('filtered extraction starts only the requested states and validates before enqueueing',async t=>{
 const ctx=await createTestLibrary(t);const report=await importFiles(ctx,[{name:'pending.txt',stream:[Buffer.from('pending synthetic')]},{name:'ready.txt',stream:[Buffer.from('ready synthetic')]},{name:'failed.txt',stream:[Buffer.from('failed synthetic')]}]);
 const [pending,ready,failed]=report.sourceIds;updateSource(ctx,{...getSource(ctx,ready),extractionState:'ready'});updateSource(ctx,{...getSource(ctx,failed),extractionState:'failed'});
 const app=await createLocalApp(ctx);await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));
 try{
  const url=`http://127.0.0.1:${(app.server.address() as any).port}`,session=await fetch(url+'/api/session'),cookie=session.headers.get('set-cookie')!.split(';')[0],csrf=(await session.json()).data.csrf;
  const post=(body:unknown)=>fetch(url+'/api/jobs',{method:'POST',headers:{cookie,'x-csrf-token':csrf,'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await post({sourceIds:[pending],onlyStates:['ready']})).status,400);
  assert.equal((await post({sourceIds:[pending,7],onlyStates:['pending']})).status,400);
  assert.equal(ctx.db.prepare('SELECT count(*) n FROM jobs').get()!.n,0);
  const res=await post({sourceIds:[pending,ready,failed,pending],onlyStates:['pending']});assert.equal(res.status,200);assert.equal((await res.json()).data.length,1);
  const retry=await post({sourceIds:[ready,failed],onlyStates:['failed']});assert.equal(retry.status,200);assert.equal((await retry.json()).data.length,1);
  const deadline=Date.now()+10000;while(Date.now()<deadline&&ctx.db.prepare("SELECT count(*) n FROM jobs WHERE state IN ('queued','running')").get()!.n)await new Promise(r=>setTimeout(r,30));
  assert.equal(ctx.db.prepare('SELECT count(*) n FROM jobs WHERE source_id=?').get(ready)!.n,0);
  assert.equal(ctx.db.prepare("SELECT count(*) n FROM jobs WHERE state='ready'").get()!.n,2);
  assert.equal(ctx.db.prepare('SELECT count(*) n FROM facts').get()!.n,0);
 }finally{await app.close();}
});
