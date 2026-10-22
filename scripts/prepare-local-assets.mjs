import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {loadConfig,projectRoot} from '../server/config.ts';

export async function prepareLocalAssets(options={}){
 const config=await loadConfig();const destination=resolve(projectRoot,options.assetDirectory??config.assetDirectory);
 await mkdir(destination,{recursive:true});const entries=[];
 for(const lang of ['chi_sim','eng']){
  const file=join(projectRoot,`node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`);
  await copyFile(file,join(destination,`${lang}.traineddata.gz`));
  entries.push({language:lang,packageVersion:'1.0.0',sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
 }
 await writeFile(join(destination,'manifest.json'),JSON.stringify(entries,null,2));
 if(options.installBrowser){
  const browserDirectory=resolve(projectRoot,options.browserDirectory??config.browserDirectory);
  const args=[join(projectRoot,'node_modules/playwright/cli.js'),'install',...(options.withDeps?['--with-deps']:[]),'chromium'];
  await new Promise((done,reject)=>{const child=spawn(process.execPath,args,{cwd:projectRoot,env:{...process.env,PLAYWRIGHT_BROWSERS_PATH:browserDirectory},stdio:'inherit',windowsHide:true});child.once('error',reject);child.once('exit',code=>code===0?done():reject(new Error(`Browser resource preparation failed (${code})`)));});
 }
 return {assetDirectory:destination,entries};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2);const options={};
 for(let i=0;i<args.length;i++){
  if(args[i]==='--browsers')options.installBrowser=true;
  else if(args[i]==='--with-deps')options.withDeps=true;
  else if(args[i]==='--asset-directory'||args[i]==='--browser-directory'){const key=args[i]==='--asset-directory'?'assetDirectory':'browserDirectory';if(!args[++i])throw new Error('Resource directory argument is missing');options[key]=args[i];}
  else throw new Error(`Unknown resource option: ${args[i]}`);
 }
 const result=await prepareLocalAssets(options);console.log('Offline OCR resources prepared:',result.assetDirectory);
}
