import assert from'node:assert/strict';
const base=process.argv[2]??'http://127.0.0.1:14317';
const response=await fetch(base+'/api/session');assert.equal(response.ok,true);
const session=(await response.json()).data,cookie=response.headers.get('set-cookie')?.split(';')[0];
async function api(path,body){const r=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,'X-CSRF-Token':session.csrf,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const result=await r.json();if(!r.ok||!result.ok)throw Error(`${path}: ${JSON.stringify(result.error)}`);return result.data;}
if(process.argv.includes('--persist')){const dossiers=await api('dossiers');assert.ok(dossiers.some(d=>d.title==='Release smoke project'));assert.equal((await api('resume-versions')).length,1);assert.equal((await api('facts')).filter(f=>f.status==='confirmed').length,1);console.log('PASS persistence after restart');}else{
assert.equal((await api('dossiers')).length,0,'smoke requires an isolated empty library');
const unknown={value:null,precision:'unknown'};
const dossier=await api('dossiers',{input:{kind:'project',title:'Release smoke project',aliases:[],dateRange:{start:unknown,end:unknown,ongoing:false},organization:'Synthetic lab',role:'Developer',summary:'Synthetic release acceptance only',skills:['TypeScript'],typedDetails:{},favorite:false},expectedRevision:null});
const text='I developed and tested the synthetic release project.';
const uploaded=await fetch(base+`/api/sources/upload?dossierId=${dossier.id}`,{method:'POST',headers:{Cookie:cookie,'X-CSRF-Token':session.csrf,'X-File-Name':'release-proof.txt'},body:text});assert.equal(uploaded.ok,true);const upload=(await uploaded.json()).data;assert.equal(upload.sourceIds.length,1);
const sourceId=upload.sourceIds[0];assert.equal((await api('dossiers')).length,1);
await api('jobs',{sourceIds:[sourceId]});
const deadline=Date.now()+20000;let source;
while(Date.now()<deadline){source=(await api('sources')).find(s=>s.id===sourceId);if(source.extractionState==='ready')break;if(['failed','unsupported'].includes(source.extractionState))throw Error('Text extraction failed');await new Promise(r=>setTimeout(r,100));}
assert.equal(source.extractionState,'ready');assert.equal((await api(`sources/${sourceId}/text?version=1`)).text,text);
assert.ok((await api('search?text=synthetic')).hits.some(h=>h.sourceId===sourceId));
const input={dossierId:dossier.id,text,ownership:'personal',metrics:[],fieldValues:{title:dossier.title,role:'Developer'},evidenceLinks:[{sourceId,sourceVersion:1,locator:{type:'statement',label:'Synthetic fixture'},excerpt:text,grade:'D'}]};
const fact=await api('facts',{input,expectedRevision:null});const confirmed=await api(`facts/${fact.id}/confirm`,{expectedRevision:fact.revision});
await api('profile',{input:{name:'Synthetic Person',email:'sample@example.com',phone:'',location:'',headline:''},expectedRevision:null});
const draft=await api('resume-drafts',{input:{roleTitle:'Developer',jobDescription:'',profileSelection:['name','email'],sections:[{title:'Projects',factIds:[fact.id]}],selectedFactRevisions:{[fact.id]:confirmed.revision},editedText:{},targetPages:1},expectedRevision:null});
const version=await api(`resume-drafts/${draft.id}/freeze`,{expectedRevision:draft.revision});
for(const format of ['pdf','docx']){const exported=await api('exports',{versionId:version.id,format});assert.equal(exported.status,'success',JSON.stringify(exported));const r=await fetch(base+`/api/exports/${exported.id}/file`,{headers:{Cookie:cookie}});const bytes=Buffer.from(await r.arrayBuffer());assert.ok(bytes.length>100);assert.equal(format==='pdf'?bytes.subarray(0,5).toString():'PK',format==='pdf'?'%PDF-':bytes.subarray(0,2).toString());}
const settings=await api('settings');const backup=await api('backups',{password:'synthetic-release-password'});assert.equal(backup.complete,true);
const restored=await api('restore',{fileName:backup.fileName,password:'synthetic-release-password',restoreDirectory:settings.libraryRoot+'/smoke-restored'});assert.equal(restored.validated,true);
console.log('PASS empty library → dossier → upload → extract/search → confirm → PDF/DOCX → encrypted restore');

}
