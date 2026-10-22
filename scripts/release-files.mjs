import{readdir,lstat,readFile}from'node:fs/promises';
import{join,extname}from'node:path';
export const publicDirectories=['src','server','shared','public','tests','examples','licenses','.github'];
export const publicFiles=['.gitignore','.dockerignore','Dockerfile','compose.yaml','package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html','LICENSE','NOTICE','README.md','CHANGELOG.md','SECURITY.md','TODO.md','PROJECT_STATE.md','DEVELOPMENT_LOG.md','启动档案.cmd','停止档案.cmd',
 'docs/media/archive-demo.png','docs/ARCHITECTURE.md','docs/FILE-MAP.md','docs/LOCAL-RUN.md','docs/DATA-RECOVERY.md','docs/RELEASING.md','docs/SOURCE-ATTRIBUTION.md','docs/source-fingerprints.json','docs/rhine-scene-fingerprints.json'];
export async function walk(root,folder=''){
 const result=[];
 for(const entry of await readdir(join(root,folder),{withFileTypes:true})){
  const rel=folder?`${folder}/${entry.name}`:entry.name;
  if(entry.isSymbolicLink())throw Error(`Release must not contain symlinks: ${rel}`);
  if(entry.isDirectory())result.push(...await walk(root,rel));else if(entry.isFile())result.push(rel);
 }
 return result.sort();
}
export async function publicSourceFiles(root){
 const files=[...publicFiles];
 for(const dir of publicDirectories)files.push(...(await walk(root,dir)).filter(p=>!p.startsWith('public/fonts/novecento/')));
 files.push(...(await walk(root,'scripts')).filter(p=>!p.endsWith('/verify-private-import.mjs')));
 for(const file of files)if(!(await lstat(join(root,file))).isFile())throw Error(`Public file missing: ${file}`);
 return [...new Set(files)].sort();
}
const privateMarkers=JSON.parse(process.env.RHINE_PRIVATE_MARKERS??'[]');
export async function inspectRelease(root,{portable=false}={}){
 const failures=[],files=await walk(root);
 for(const file of files){
  const parts=file.split('/');
  if(parts.some(p=>['.git','.rhine-archive','private','node_modules-cache'].includes(p))||/\.(?:sqlite|db)(?:-|$)|\.growth$/i.test(file))failures.push(`private storage path: ${file}`);
  if(file.startsWith('runtime/')&&!(portable&&/^runtime\/(ocr|browsers)\//.test(file)))failures.push(`unexpected runtime path: ${file}`);
  if(!parts.includes('node_modules')&&['.ts','.mts','.js','.mjs','.json','.md','.yml','.yaml','.cmd','.ps1','.html','.css','.txt',''].includes(extname(file))){
   const text=await readFile(join(root,file),'utf8');
   if(privateMarkers.some(marker=>text.includes(marker))||/[A-Za-z]:[\\/](?:Users|Desktop)[\\/]/i.test(text))failures.push(`private identity or machine path: ${file}`);
   if(/gh[pousr]_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9]{32,}|-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----/.test(text))failures.push(`possible secret: ${file}`);
  }
 }
 if(failures.length)throw Error(failures.join('\n'));
 return{fileCount:files.length,privateStorageFiles:0,privateMarkers:0};
}
