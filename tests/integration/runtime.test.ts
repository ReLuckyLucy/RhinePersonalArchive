import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,mkdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {startLocal} from '../../scripts/start-local.mjs';
import {stopLocal} from '../../scripts/stop-local.mjs';
import {systemOpenCommand} from '../../scripts/open-source.mjs';
import {prepareLocalAssets} from '../../scripts/prepare-local-assets.mjs';

const project=resolve(import.meta.dirname,'../..');
const overrideNames=['RHINE_CONFIG_FILE','RHINE_LIBRARY_ROOT','RHINE_BACKUP_DIRECTORY','RHINE_ASSET_DIRECTORY','RHINE_BROWSER_DIRECTORY','RHINE_PORT','RHINE_BIND_HOST'];
function evaluateConfig(configPath:string,overrides:Record<string,string>={}){
 const env={...process.env};for(const key of overrideNames)delete env[key];
 const script=`const {loadConfig}=await import('./server/config.ts');console.log(JSON.stringify(await loadConfig()));`;
 const result=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:project,encoding:'utf8',env:{...env,RHINE_CONFIG_FILE:configPath,...overrides}});
 assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);
}
test('fresh configuration uses absolute project-relative portable directories',async t=>{
 const root=await mkdtemp(join(tmpdir(),'rhine-config-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const path=join(root,'config.json');const config=evaluateConfig(path);
 assert.deepEqual(config,{libraryRoot:join(project,'runtime/library'),backupDirectory:join(project,'runtime/backups'),port:4317,assetDirectory:join(project,'runtime/ocr'),browserDirectory:join(project,'runtime/browsers')});
 assert.deepEqual(evaluateConfig(path),config);
});
test('explicit environment overrides take precedence over existing settings',async t=>{
 const root=await mkdtemp(join(tmpdir(),'rhine-config-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const path=join(root,'config.json');const saved={libraryRoot:join(root,'saved-library'),backupDirectory:join(root,'saved-backups'),port:14318,assetDirectory:join(root,'saved-ocr'),browserDirectory:join(root,'saved-browsers')};
 await writeFile(path,JSON.stringify(saved));assert.deepEqual(evaluateConfig(path),saved);
 const overrides={RHINE_LIBRARY_ROOT:join(root,'library'),RHINE_BACKUP_DIRECTORY:join(root,'backups'),RHINE_PORT:'14319',RHINE_ASSET_DIRECTORY:join(root,'ocr'),RHINE_BROWSER_DIRECTORY:join(root,'browsers')};
 assert.deepEqual(evaluateConfig(path,overrides),{libraryRoot:overrides.RHINE_LIBRARY_ROOT,backupDirectory:overrides.RHINE_BACKUP_DIRECTORY,port:14319,assetDirectory:overrides.RHINE_ASSET_DIRECTORY,browserDirectory:overrides.RHINE_BROWSER_DIRECTORY});
 assert.deepEqual(JSON.parse(await readFile(path,'utf8')),saved);
});
test('starter and server share environment port overrides without touching saved configuration',async t=>{
 const root=await mkdtemp(join(tmpdir(),'rhine-start-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const probe=createServer();await new Promise<void>(done=>probe.listen(0,'127.0.0.1',done));const port=(probe.address()as any).port;await new Promise<void>(done=>probe.close(()=>done()));
 const path=join(root,'config.json');const config={libraryRoot:join(root,'library'),backupDirectory:join(root,'backups'),port:14318,assetDirectory:join(root,'ocr'),browserDirectory:join(root,'browsers')};
 await mkdir(config.libraryRoot);await writeFile(path,JSON.stringify(config));
 const prior=process.env.RHINE_PORT;process.env.RHINE_PORT=String(port);
 try{const started=await startLocal({configPath:path});assert.equal(started.url,`http://127.0.0.1:${port}`);assert.equal(JSON.parse(await readFile(path,'utf8')).port,14318);await stopLocal({configPath:path});}
 finally{await stopLocal({configPath:path}).catch(()=>{});if(prior===undefined)delete process.env.RHINE_PORT;else process.env.RHINE_PORT=prior;}
});
test('resource preparation supports an explicit offline OCR directory',async t=>{
 const root=await mkdtemp(join(tmpdir(),'rhine-assets-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const result=await prepareLocalAssets({assetDirectory:root});assert.equal(result.assetDirectory,root);assert.equal(result.entries.length,2);
 for(const entry of result.entries){assert.match(entry.sha256,/^[a-f0-9]{64}$/);assert.ok((await readFile(join(root,entry.language+'.traineddata.gz'))).length>1000);}
});
test('desktop opening keeps file names as arguments and clearly rejects containers',()=>{
 const file='/tmp/a $name; document.pdf';assert.deepEqual(systemOpenCommand(file,'source','linux',{DISPLAY:':0'}),{command:'xdg-open',args:[file]});
 assert.deepEqual(systemOpenCommand(file,'source','darwin',{}),{command:'open',args:[file]});
 assert.throws(()=>systemOpenCommand(file,'source','linux',{RHINE_CONTAINER:'1',DISPLAY:':0'}),{code:'OPEN_UNAVAILABLE'});
 assert.throws(()=>systemOpenCommand(file,'source','linux',{}),{code:'OPEN_UNAVAILABLE'});
});
