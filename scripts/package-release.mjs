import{mkdir,copyFile,cp,readFile,writeFile}from'node:fs/promises';
import{createReadStream}from'node:fs';
import{resolve,join,dirname}from'node:path';
import{spawn}from'node:child_process';
import{createHash}from'node:crypto';
import{loadConfig,projectRoot}from'../server/config.ts';
import{publicSourceFiles,walk,inspectRelease}from'./release-files.mjs';
import{createZip}from'./zip.mjs';
async function run(command,args,cwd){await new Promise((done,reject)=>{const p=spawn(command,args,{cwd,stdio:'inherit',windowsHide:true});p.once('error',reject);p.once('exit',n=>n===0?done():reject(Error(`${command} failed (${n})`)));});}
const kind=process.argv[2]??'source';if(!['source','windows'].includes(kind))throw Error('Choose source or windows');
if(kind==='windows'&&(process.platform!=='win32'||process.arch!=='x64'||!process.version.startsWith('v24.10.')))throw Error('Windows bundles must be assembled on Windows');
const pkg=JSON.parse(await readFile(join(projectRoot,'package.json'),'utf8'));
const label=`RhinePersonalArchive-v${pkg.version}-${kind==='source'?'source':'windows-x64'}`;
const output=resolve(projectRoot,'release'),stage=join(output,label);await mkdir(output,{recursive:true});await mkdir(stage,{recursive:false});
const source=await publicSourceFiles(projectRoot);
for(const file of source){await mkdir(dirname(join(stage,file)),{recursive:true});await copyFile(join(projectRoot,file),join(stage,file));}
if(kind==='windows'){
 await copyFile(process.execPath,join(stage,'node.exe'));
 if(process.version!=='v24.10.0')throw Error('This release vendors the Node 24.10.0 license; build with that exact version');
 await copyFile(join(projectRoot,'licenses/NODE-v24.10.0.txt'),join(stage,'NODE-LICENSE.txt'));
 // Production dependencies come from the lockfile, never the development node_modules.
 await run(process.execPath,[join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),'ci','--omit=dev'],stage);
 await cp(join(projectRoot,'dist'),join(stage,'dist'),{recursive:true});
 const config=await loadConfig();await mkdir(join(stage,'runtime'),{recursive:true});
 await cp(config.assetDirectory,join(stage,'runtime/ocr'),{recursive:true});
 await cp(config.browserDirectory,join(stage,'runtime/browsers'),{recursive:true,filter:p=>!p.replaceAll('\\','/').includes('/.links')});
 // Examples/tests remain available, but no generated fixture, user config or data is copied.
}
const checked=await inspectRelease(stage,{portable:kind==='windows'});
await writeFile(join(stage,'RELEASE-MANIFEST.json'),JSON.stringify({name:pkg.name,version:pkg.version,kind,builtAt:new Date().toISOString(),...checked},null,2));
const files=await walk(stage),archive=join(output,label+'.zip');await createZip(stage,files,archive,label+'/');
const hash=createHash('sha256');for await(const bytes of createReadStream(archive))hash.update(bytes);
const checksum=`${hash.digest('hex')}  ${label}.zip\n`;await writeFile(join(output,label+'.sha256'),checksum);console.log(checksum.trim());
