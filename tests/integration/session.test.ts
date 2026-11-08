import {test} from 'node:test';
import type {TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {sessions} from '../../server/session.ts';
import {AppError} from '../../shared/errors.ts';

const nativeFetch=globalThis.fetch;
let clientModule=0;
type Attempt={path:string;url:string;fileName:string|undefined;csrf:string|undefined;body:string;library:string};

function gate(){let release!:()=>void;const wait=new Promise<void>(done=>release=done);return {wait,release};}

async function harness(t:TestContext){
 const parent=await mkdtemp(join(tmpdir(),'rhine-session-test-')),first=join(parent,'first'),second=join(parent,'second');
 await Promise.all([mkdir(first),mkdir(second)]);
 let auth=sessions(first),library=first,sessionCount=0,cookie='';
 const attempts:Attempt[]=[],accepted:Attempt[]=[],rejected:Attempt[]=[];
 const blockedRejections=new Map<string,ReturnType<typeof gate>>(),gates=new Set<ReturnType<typeof gate>>();
 let blockedSession:ReturnType<typeof gate>|undefined;
 const server=createServer(async(req,res)=>{
  const path=new URL(req.url??'/',`http://${req.headers.host}`).pathname;
  const attempt={path,url:req.url!,fileName:req.headers['x-file-name'] as string|undefined,csrf:req.headers['x-csrf-token'] as string|undefined,body:'',library};
  try{
   auth.boundary(req);
   if(path==='/api/session'){
    sessionCount++;
    const data=auth.create(req,res);
    if(blockedSession){const pending=blockedSession;blockedSession=undefined;await pending.wait;}
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,data}));return;
   }
   attempts.push(attempt);
   auth.check(req);
   for await(const chunk of req)attempt.body+=chunk.toString();
   const fault=/^\/api\/fail\/(\d+)\/([A-Z_]+)$/.exec(path);
   if(fault)throw new AppError(fault[2],'合成错误',Number(fault[1]));
   accepted.push(attempt);
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,data:{body:attempt.body,path}}));
  }catch(error){
   const e=error as AppError;
   if(e.code==='SESSION_REQUIRED'||e.code==='CSRF'){
    rejected.push(attempt);const blocked=blockedRejections.get(path);if(blocked){blockedRejections.delete(path);await blocked.wait;}
   }
   req.resume();res.statusCode=e.status??500;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:false,error:{code:e.code,message:e.message}}));
  }
 });
 await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));
 const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 t.after(async()=>{
  for(const pending of gates)pending.release();
  await new Promise<void>((done,reject)=>server.close(error=>error?reject(error):done()));
  assert.ok(parent.startsWith(resolve(tmpdir())+sep));await rm(parent,{recursive:true,force:true});
 });
 async function browserFetch(input:string|URL|Request,init?:RequestInit){
  const headers=new Headers(init?.headers);if(cookie)headers.set('Cookie',cookie);
  const response=await nativeFetch(new URL(String(input),base),{...init,headers});
  const setCookie=response.headers.get('set-cookie');if(setCookie)cookie=setCookie.split(';')[0];
  return response;
 }
 return {base,first,second,parent,attempts,accepted,rejected,browserFetch,
  get sessionCount(){return sessionCount;},get cookie(){return cookie;},
  restart(root=first){library=root;auth=sessions(root);},
  holdRejection(path:string){const pending=gate();gates.add(pending);blockedRejections.set('/api/'+path,pending);return pending;},
  holdNextSession(){const pending=gate();gates.add(pending);return blockedSession=pending;},
 };
}

async function client(t:TestContext,h:Awaited<ReturnType<typeof harness>>,intercept?:typeof fetch){
 t.mock.method(globalThis,'fetch',intercept??h.browserFetch);
 return import('../../src/api/client.ts?session-test='+clientModule++);
}

async function until(predicate:()=>boolean){
 const deadline=Date.now()+3000;
 while(!predicate()){assert.ok(Date.now()<deadline,'session test condition timed out');await new Promise(done=>setTimeout(done,5));}
}

test('sessions keep one cookie and CSRF for concurrent pages while rejecting foreign requests',async t=>{
 const h=await harness(t);
 const a=await h.browserFetch('/api/session'),one=(await a.json()).data,cookie=h.cookie;
 const b=await h.browserFetch('/api/session'),two=(await b.json()).data;
 assert.equal(two.csrf,one.csrf);assert.equal(h.cookie,cookie);
 assert.equal((await h.browserFetch('/api/write',{method:'POST',headers:{'X-CSRF-Token':one.csrf},body:'synthetic'})).status,200);
 assert.equal((await h.browserFetch('/api/session',{headers:{Origin:'https://foreign.example'}})).status,403);
});

test('library identity follows the actual directory across restarts and aliases without exposing its path',async t=>{
 const h=await harness(t),one=(await(await h.browserFetch('/api/session')).json()).data;
 assert.match(one.libraryId,/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify(one).includes(h.parent));
 h.restart();const restarted=(await(await h.browserFetch('/api/session')).json()).data;
 assert.equal(restarted.libraryId,one.libraryId);assert.notEqual(restarted.instanceId,one.instanceId);
 const alias=join(h.parent,'alias');await symlink(h.first,alias,process.platform==='win32'?'junction':'dir');
 h.restart(alias);assert.equal((await(await h.browserFetch('/api/session')).json()).data.libraryId,one.libraryId);
 h.restart(h.second);assert.notEqual((await(await h.browserFetch('/api/session')).json()).data.libraryId,one.libraryId);
});

test('an expired cookie is replaced while the library identity remains stable',async t=>{
 const h=await harness(t);let now=Date.now();t.mock.method(Date,'now',()=>now);
 const one=(await(await h.browserFetch('/api/session')).json()).data,cookie=h.cookie;
 now+=24*3600*1000+1;
 assert.equal((await h.browserFetch('/api/read')).status,401);
 const two=(await(await h.browserFetch('/api/session')).json()).data;
 assert.notEqual(h.cookie,cookie);assert.notEqual(two.csrf,one.csrf);assert.equal(two.libraryId,one.libraryId);
});

for(const data of [{csrf:'synthetic',instanceId:'synthetic',appId:'rhine-personal-archive-v1'},{csrf:'synthetic',instanceId:'synthetic',appId:'other-app',libraryId:'synthetic'}]){
 test('an invalid session identity never authorizes an API request: '+JSON.stringify(data),async t=>{
  const h=await harness(t),c=await client(t,h,async(input,init)=>String(input)==='/api/session'?new Response(JSON.stringify({ok:true,data}),{headers:{'Content-Type':'application/json'}}):h.browserFetch(input,init));
  await assert.rejects(c.api('write',{note:'must not send'}),/连接|会话|刷新/);assert.equal(h.attempts.length,0);
 });
}

test('a same-library restart renews rejected API writes once and applies each write once',async t=>{
 const h=await harness(t),c=await client(t,h);await c.api('ready');h.restart();
 assert.deepEqual(await c.api('write',{note:'synthetic restart edit'}),{path:'/api/write',body:'{"note":"synthetic restart edit"}'});
 assert.equal(h.sessionCount,2);assert.equal(h.attempts.filter(a=>a.path==='/api/write').length,2);
 assert.equal(h.accepted.filter(a=>a.path==='/api/write').length,1);
});

test('concurrent rejected requests share one renewal',async t=>{
 const h=await harness(t),c=await client(t,h);await c.api('ready');h.restart();
 const held=h.holdNextSession();
 const calls=Promise.all(['one','two','three'].map(note=>c.api('write',{note})));calls.catch(()=>{});
 await until(()=>h.rejected.length===3&&h.sessionCount===2);held.release();
 await calls;
 assert.equal(h.sessionCount,2);assert.equal(h.accepted.filter(a=>a.path==='/api/write').length,3);
});

test('a late rejection from the old token reuses a completed renewal',async t=>{
 const h=await harness(t),c=await client(t,h);await c.api('ready');h.restart();
 const held=h.holdRejection('late'),late=c.api('late',{note:'late'});late.catch(()=>{});
 await until(()=>h.rejected.some(a=>a.path==='/api/late'));
 await c.api('fast',{note:'fast'});held.release();await late;
 assert.equal(h.sessionCount,2);assert.equal(h.accepted.filter(a=>['/api/late','/api/fast'].includes(a.path)).length,2);
});

test('confirmed CSRF rejection renews then replays the request with the current token',async t=>{
 const h=await harness(t);let corrupt=true;
 const c=await client(t,h,async(input,init)=>{
  if(String(input)==='/api/write'&&corrupt){corrupt=false;const headers=new Headers(init?.headers);headers.set('X-CSRF-Token','stale');return h.browserFetch(input,{...init,headers});}
  return h.browserFetch(input,init);
 });
 await c.api('write',{note:'csrf test'});
 assert.equal(h.sessionCount,2);assert.equal(h.rejected[0].csrf,'stale');assert.equal(h.accepted.length,1);
});

for(const [status,code]of [[400,'VALIDATION'],[401,'VALIDATION'],[403,'FOREIGN_REQUEST'],[403,'VALIDATION'],[500,'SESSION_REQUIRED'],[503,'UNAVAILABLE']] as const){
 test(`HTTP ${status} ${code} never renews or replays`,async t=>{
  const h=await harness(t),c=await client(t,h);
  await assert.rejects(c.api(`fail/${status}/${code}`,{note:'synthetic'}),{message:'合成错误'});
  assert.equal(h.sessionCount,1);assert.equal(h.attempts.length,1);
 });
}

for(const [status,code]of [[401,'SESSION_REQUIRED'],[403,'CSRF']] as const){
 test(`a repeated ${code} fails after one replay`,async t=>{
  const h=await harness(t),c=await client(t,h);
  await assert.rejects(c.api(`fail/${status}/${code}`,{note:'synthetic'}),{message:'合成错误'});
  assert.equal(h.sessionCount,2);assert.equal(h.attempts.length,2);
 });
}

test('network errors are not replayed',async t=>{
 const h=await harness(t);let calls=0;
 const failure=new TypeError('synthetic disconnected response');
 const c=await client(t,h,async(input,init)=>{if(String(input)==='/api/write'){calls++;throw failure;}return h.browserFetch(input,init);});
 await assert.rejects(c.api('write',{note:'synthetic'}),error=>error===failure);
 assert.equal(calls,1);assert.equal(h.sessionCount,1);
});

test('renewal refuses edits and all later requests after switching libraries',async t=>{
 const h=await harness(t),c=await client(t,h);await c.api('ready');h.restart(h.second);
 await assert.rejects(c.api('write',{note:'old library edit'}),/资料库.*刷新|刷新.*资料库/);
 const attempts=h.attempts.length;
 await assert.rejects(c.api('write',{note:'another old edit'}),/资料库.*刷新|刷新.*资料库/);
 await assert.rejects(c.api('read'),/资料库.*刷新|刷新.*资料库/);
 assert.equal(h.attempts.length,attempts);assert.equal(h.sessionCount,2);
 assert.equal(h.accepted.filter(a=>a.library===h.second).length,0);
});

test('a replayable file upload survives same-library renewal with its name and dossier',async t=>{
 const h=await harness(t),c=await client(t,h);await c.api('ready');h.restart();
 const file=new File(['synthetic upload bytes'],'合成材料.txt',{type:'text/plain'});
 const result=await c.uploadFile(file,'synthetic dossier');
 assert.equal(result.body,'synthetic upload bytes');assert.equal(h.sessionCount,2);
 assert.equal(h.attempts.filter(a=>a.path==='/api/sources/upload').length,2);
 const uploads=h.accepted.filter(a=>a.path==='/api/sources/upload');assert.equal(uploads.length,1);
 assert.equal(uploads[0].url,'/api/sources/upload?dossierId=synthetic%20dossier');assert.equal(uploads[0].fileName,encodeURIComponent('合成材料.txt'));
});

test('an upload is not replayed into a different library',async t=>{
 const h=await harness(t),c=await client(t,h);await c.api('ready');h.restart(h.second);
 await assert.rejects(c.uploadFile(new File(['synthetic sensitive text'],'synthetic.txt')),/资料库.*刷新|刷新.*资料库/);
 assert.equal(h.attempts.filter(a=>a.path==='/api/sources/upload').length,1);
 assert.equal(h.accepted.filter(a=>a.library===h.second).length,0);
});

test('aborting a renewal wait does not send its replay or cancel another caller',async t=>{
 const h=await harness(t),c=await client(t,h);await c.api('ready');h.restart();
 const held=h.holdNextSession(),controller=new AbortController();
 const aborted=assert.rejects(c.api('aborted',{note:'must not replay'},controller.signal),{name:'AbortError'});
 aborted.catch(()=>{});
 await until(()=>h.sessionCount===2);controller.abort();await aborted;
 const next=c.api('next',{note:'must succeed'});held.release();await next;
 assert.equal(h.sessionCount,2);assert.equal(h.accepted.filter(a=>a.path==='/api/aborted').length,0);
 assert.equal(h.accepted.filter(a=>a.path==='/api/next').length,1);
});

test('an already aborted API request does not establish a session',async t=>{
 const h=await harness(t),c=await client(t,h),controller=new AbortController();controller.abort();
 await assert.rejects(c.api('write',{note:'must not send'},controller.signal),{name:'AbortError'});
 assert.equal(h.sessionCount,0);assert.equal(h.attempts.length,0);
});
