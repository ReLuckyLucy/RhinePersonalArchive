import { readFile,mkdir,writeFile,rename,stat,realpath,rm } from 'node:fs/promises';
import { resolve,dirname,isAbsolute,relative } from 'node:path';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {AppError} from '../shared/errors.ts';
import type { LocalConfig } from '../shared/domain.ts';
export const projectRoot=resolve(import.meta.dirname,'..');
export function getConfigPath(path?:string){return resolve(projectRoot,path??process.env.RHINE_CONFIG_FILE??'runtime/config.json');}
const schema=z.object({libraryRoot:z.string().min(1),backupDirectory:z.string().min(1),port:z.number().int().min(1024).max(65535),assetDirectory:z.string().min(1),browserDirectory:z.string().min(1)}).strict();
export async function loadConfig(path?:string):Promise<LocalConfig>{
 let saved:Partial<LocalConfig>={};
 try{saved=schema.parse(JSON.parse(await readFile(getConfigPath(path),'utf8')));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 const config:LocalConfig={libraryRoot:resolve(projectRoot,'runtime/library'),backupDirectory:resolve(projectRoot,'runtime/backups'),port:4317,assetDirectory:resolve(projectRoot,'runtime/ocr'),browserDirectory:resolve(projectRoot,'runtime/browsers'),...saved};
 const directories={libraryRoot:'RHINE_LIBRARY_ROOT',backupDirectory:'RHINE_BACKUP_DIRECTORY',assetDirectory:'RHINE_ASSET_DIRECTORY',browserDirectory:'RHINE_BROWSER_DIRECTORY'}as const;
 for(const [key,variable]of Object.entries(directories)as [keyof typeof directories,string][]){const value=process.env[variable];if(value!==undefined){if(!value.trim())throw new AppError('INVALID_DIRECTORY',`${variable} 不能为空`);config[key]=resolve(projectRoot,value);}}
 if(process.env.RHINE_PORT!==undefined)config.port=Number(process.env.RHINE_PORT);
 return schema.parse(config);
}
export function getBindHost(){const value=process.env.RHINE_BIND_HOST??'127.0.0.1';if(value!=='127.0.0.1'&&value!=='0.0.0.0')throw new AppError('INVALID_BIND_HOST','RHINE_BIND_HOST 仅支持 127.0.0.1 或容器内的 0.0.0.0');return value;}
export async function saveConfig(input:LocalConfig){const config=schema.parse(input);for(const key of ['libraryRoot','backupDirectory','assetDirectory','browserDirectory']as const){if(!isAbsolute(config[key])||config[key].startsWith('\\\\'))throw new AppError('INVALID_DIRECTORY','请选择本机绝对目录');}if(!(await stat(config.libraryRoot)).isDirectory())throw new AppError('INVALID_DIRECTORY','资料库目录不存在');const root=await realpath(config.libraryRoot);const rel=relative(root,resolve(config.backupDirectory));if(!rel.startsWith('..')&&!isAbsolute(rel))throw new AppError('BACKUP_LOCATION','备份须保存在资料库以外');const probe=resolve(root,`.rhine-write-check-${randomUUID()}`);try{await writeFile(probe,'',{flag:'wx'});}finally{await rm(probe,{force:true});}const path=getConfigPath();await mkdir(dirname(path),{recursive:true});await writeFile(path+'.tmp',JSON.stringify(config,null,2));await rename(path+'.tmp',path);}
