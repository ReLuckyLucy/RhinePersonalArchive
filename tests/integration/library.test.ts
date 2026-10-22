import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { request } from 'node:http';
import { migrate,migrations } from '../../server/db/migrations.ts';
import { openLibrary, closeLibrary } from '../../server/db/database.ts';
import { saveDossier, listDossiers, saveProfile } from '../../server/archive/repository.ts';
import { createLocalApp } from '../../server/app.ts';
const unknown={value:null,precision:'unknown'} as const;
const input={kind:'project',title:"合成项目 ' ; SELECT",aliases:[],dateRange:{start:unknown,end:unknown,ongoing:false},organization:'',role:'',summary:'',skills:[],typedDetails:{technologies:[]},favorite:false} as const;
test('persists dates without inventing precision; rejects stale edits',async()=>{
 const root=await mkdtemp(resolve('runtime/test-library-'));let ctx=await openLibrary(root);
 try {const one=saveDossier(ctx,input,null);assert.deepEqual(one.dateRange.start,unknown);await closeLibrary(ctx);ctx=await openLibrary(root);assert.equal(listDossiers(ctx,{})[0].id,one.id);
 const updated=saveDossier(ctx,{...input,id:one.id,title:'修订'},1);assert.equal(updated.revision,2);assert.throws(()=>saveDossier(ctx,{...input,id:one.id},1),{code:'CONFLICT'});
 assert.throws(()=>saveDossier(ctx,{...input,dateRange:{...input.dateRange,start:{value:'2023-02-29',precision:'day'}}},null));
 assert.throws(()=>saveProfile(ctx,{name:'',email:'wrong',phone:'',location:'',headline:''},null));
 ctx.db.exec('PRAGMA query_only=ON');assert.throws(()=>saveDossier(ctx,input,null));assert.equal(listDossiers(ctx,{}).length,1);
 }finally{await closeLibrary(ctx);await rm(root,{recursive:true});}
});
test('rejects foreign requests and requires a session and CSRF',async()=>{
 const root=await mkdtemp(resolve('runtime/test-http-'));const ctx=await openLibrary(root);const app=await createLocalApp(ctx);
 await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));const port=(app.server.address() as any).port;const url=`http://127.0.0.1:${port}`;
 try{assert.equal((await fetch(url+'/api/dossiers')).status,401);assert.equal((await fetch(url+'/api/session',{headers:{Origin:'https://foreign.example'}})).status,403);
 const foreign=await new Promise<number>(r=>{const q=request(url+'/api/session',{headers:{Host:'foreign.example'}},res=>{res.resume();r(res.statusCode!);});q.end();});assert.equal(foreign,403);
 const session=await fetch(url+'/api/session');const cookie=session.headers.get('set-cookie')!.split(';')[0];const token=(await session.json()).data.csrf;
 assert.match(session.headers.get('set-cookie')!,/HttpOnly/);assert.equal(session.headers.get('cache-control'),'no-store');
 assert.equal((await fetch(url+'/api/dossiers',{method:'POST',headers:{cookie,'content-type':'application/json'},body:'{}'})).status,403);
 assert.equal((await fetch(url+'/api/dossiers',{method:'POST',headers:{cookie,'x-csrf-token':token,'content-type':'application/json'},body:'{'})).status,400);
 const valid=await fetch(url+'/api/dossiers',{method:'POST',headers:{cookie,'x-csrf-token':token,'content-type':'application/json'},body:JSON.stringify({input,expectedRevision:null})});assert.equal(valid.status,200);
 }finally{await app.close();await closeLibrary(ctx);await rm(root,{recursive:true});}
});
test('failed migration rolls back schema and version',async()=>{const root=await mkdtemp(resolve('runtime/test-migration-'));const ctx=await openLibrary(root);try{await assert.rejects(migrate(ctx.db,ctx.runtimeRoot,[...migrations,'CREATE TABLE accidental(id TEXT); THIS IS INVALID']));assert.equal((ctx.db.prepare('PRAGMA user_version').get() as any).user_version,migrations.length);assert.equal(ctx.db.prepare("SELECT name FROM sqlite_master WHERE name='accidental'").get(),undefined);}finally{await closeLibrary(ctx);await rm(root,{recursive:true});}});
import {readFile} from 'node:fs/promises';import {createTestLibrary} from '../helpers/library.ts';import {importFiles} from '../../server/sources/import.ts';
test('PDF materials allow same-origin inline preview while unrelated pages cannot embed the app',async t=>{const ctx=await createTestLibrary(t);async function* files(){yield{name:'preview.pdf',stream:[await readFile('tests/fixtures/materials/text.pdf')]};}const report=await importFiles(ctx,files());const app=await createLocalApp(ctx);await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${(app.server.address() as any).port}`;try{const session=await fetch(url+'/api/session'),cookie=session.headers.get('set-cookie')!.split(';')[0];const r=await fetch(url+`/api/sources/${report.sourceIds[0]}/file`,{headers:{cookie}});assert.equal(r.status,200);assert.equal(r.headers.get('x-frame-options'),'SAMEORIGIN');assert.ok(!r.headers.get('content-security-policy')!.includes('sandbox'));assert.equal((await fetch(url+'/api/health')).headers.get('x-frame-options'),'DENY');await r.arrayBuffer();}finally{await app.close();}});
