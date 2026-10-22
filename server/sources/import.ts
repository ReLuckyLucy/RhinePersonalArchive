import { readFile,mkdir,rename,rm } from 'node:fs/promises';import { createWriteStream } from 'node:fs';import { pipeline } from 'node:stream/promises';import { Readable,Transform } from 'node:stream';import { basename,extname,join,relative } from 'node:path';import { randomUUID,createHash } from 'node:crypto';
import type { LibraryContext } from '../db/database.ts';import type { Source,DossierInput } from '../../shared/domain.ts';import { dossierKind } from '../../shared/schemas.ts';import { safePath,hashStable } from './paths.ts';import { getSource,updateSource } from './repository.ts';import { transaction } from '../db/transaction.ts';import { getDossier,saveDossier } from '../archive/repository.ts';import { AppError } from '../../shared/errors.ts';
export type ImportReport={batchId:string;sourceIds:string[];sourceCount:number;originCount:number;newSources:number;changed:number;missing:number;errors:{record:string;code:string}[]};
export type IncomingFile={name:string;stream:AsyncIterable<Uint8Array>};
function kind(category:string,explicit?:unknown):DossierInput['kind']{
 const parsed=dossierKind.safeParse(explicit??category);
 if(parsed.success)return parsed.data;
 if(explicit!==undefined)throw new AppError('INVALID_DOSSIER_KIND','档案类型无效');
 if(/参考|模板|^08_|^90_/.test(category))return'reference';if(/教育|学籍/.test(category))return'education';if(/实习|工作/.test(category))return'work';if(/竞赛|荣誉|奖/.test(category))return'award';if(/科研|知识产权/.test(category))return'research';if(/志愿|组织/.test(category))return'volunteer';if(/作品集|个人品牌/.test(category))return'portfolio';return'project';
}
const unknown={value:null,precision:'unknown'} as const;
export async function importCatalog(ctx:LibraryContext,manifestPath:string):Promise<ImportReport>{
 const path=await safePath(ctx,typeof manifestPath==='string'?manifestPath.replaceAll('\\','/'):manifestPath);
 const content=JSON.parse(await readFile(path,'utf8')),records=Array.isArray(content)?content:content.records;
 if(!Array.isArray(records)||records.length>100000)throw new AppError('INVALID_CATALOG','资料索引格式无效');
 const canonical=relative(ctx.libraryRoot,path).replaceAll('\\','/');
 const aliases=[canonical,canonical.replaceAll('/','\\'),manifestPath.replaceAll('\\','/'),manifestPath.replaceAll('/','\\')];
 return ctx.writeQueue(()=>importRecords(ctx,records,canonical,undefined,aliases));
}
function topicOwner(ctx:LibraryContext,prefixes:string[],topicKey:string):string|undefined {
 const placeholders=prefixes.map(()=>'?').join(',');
 const mapped=ctx.db.prepare(`SELECT DISTINCT dossier_id FROM catalog_topics WHERE catalog_key IN (${placeholders}) AND topic_key=?`).all(...prefixes,topicKey);
 if(mapped.length===1)return mapped[0].dossier_id as string;
 if(mapped.length>1)throw new AppError('AMBIGUOUS_TOPIC','同一索引主题存在多个档案归属');
 const owners=ctx.db.prepare(`SELECT DISTINCT d.id,CASE WHEN s.key IS NULL THEN 1 ELSE 0 END active FROM origins o
 JOIN dossier_sources ds ON ds.source_id=o.source_id JOIN dossiers d ON d.id=ds.dossier_id
 LEFT JOIN settings s ON s.key='archived-dossier:'||d.id
 WHERE substr(o.id,1,64) IN (${placeholders}) AND json_extract(o.data,'$.uploadDossierId') IS NULL
 AND json_array(CAST(coalesce(json_extract(o.data,'$.category'),'') AS TEXT),CAST(coalesce(json_extract(o.data,'$.subject'),'待整理材料') AS TEXT))=?`).all(...prefixes,topicKey);
 // No linked owner is an interrupted legacy import and can safely be completed.
 if(!owners.length)return undefined;
 const live=owners.filter(o=>o.active===1);
 if(live.length===1)return live[0].id as string;
 if(owners.length===1)return owners[0].id as string;
 throw new AppError('AMBIGUOUS_TOPIC','索引主题的历史归属需要人工检查');
}
async function importRecords(ctx:LibraryContext,records:any[],catalogKey:string,dossierId?:string,aliases=[catalogKey]){
 const report:ImportReport={batchId:randomUUID(),sourceIds:[],sourceCount:0,originCount:0,newSources:0,changed:0,missing:0,errors:[]};
 const hash=(key:string)=>createHash('sha256').update(key.toLowerCase()).digest('hex');
 const prefix=hash(catalogKey),prefixes=[...new Set([prefix,...aliases.map(hash)])];
 for(const [index,record]of records.entries()){
  const input=record.archiveRel??record.relativePath;let checked:{hash:string;bytes:number};let path:string;
  try{path=await safePath(ctx,typeof input==='string'?input.replaceAll('\\','/'):input);checked=await hashStable(path);}
  catch(error){const e=error as any;const old=ctx.db.prepare('SELECT data FROM sources WHERE relative_path=? COLLATE NOCASE').get(String(input).replaceAll('\\','/'));if(e.code==='ENOENT'){report.missing++;if(old)updateSource(ctx,{...JSON.parse(old.data as string),availability:'missing'});}else report.errors.push({record:String(record.id??index),code:e.code??'READ_FAILED'});continue;}
  const rel=relative(ctx.libraryRoot,path).replaceAll('\\','/');
  let committed:{sourceId:string;newSource:boolean;changed:boolean};
  try{committed=transaction(ctx.db,()=>{
   const title=String(record.subject??'待整理材料'),rawCategory=String(record.category??''),topicKey=JSON.stringify([rawCategory,title]);
   const owner=dossierId??topicOwner(ctx,prefixes,topicKey);
   const prior=ctx.db.prepare('SELECT data FROM sources WHERE relative_path=? COLLATE NOCASE').get(rel);
   const duplicate=prior??ctx.db.prepare('SELECT data FROM sources WHERE hash=?').get(checked.hash);
   let source:Source|undefined=duplicate?JSON.parse(duplicate.data as string):undefined;
   const newSource=!source,changed=!!(prior&&source&&source.hash!==checked.hash);
   if(!source){source={id:randomUUID(),relativePath:rel,hash:checked.hash,bytes:checked.bytes,version:1,kind:extname(path).toLowerCase().slice(1),name:basename(path),availability:'available',extractionState:'pending'};ctx.db.prepare('INSERT INTO sources VALUES(?,?,?,?,?)').run(source.id,rel,source.hash,1,JSON.stringify(source));}
   else if(changed){ctx.db.prepare('UPDATE source_versions SET available=0 WHERE source_id=? AND relative_path=? COLLATE NOCASE').run(source.id,rel);source={...source,hash:checked.hash,bytes:checked.bytes,version:source.version+1,availability:'available',extractionState:'pending'};updateSource(ctx,source);}
   else if(prior){source={...source,availability:'available'};updateSource(ctx,source);ctx.db.prepare('UPDATE source_versions SET available=1 WHERE source_id=? AND version=? AND hash=?').run(source.id,source.version,checked.hash);}
   ctx.db.prepare('INSERT OR IGNORE INTO source_versions VALUES(?,?,?,?,?,?)').run(source.id,source.version,source.hash,source.relativePath,1,JSON.stringify(source));
   const recordId=String(record.id??index);
   ctx.db.prepare('INSERT INTO origins VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET source_id=excluded.source_id,data=excluded.data').run(`${prefix}:${recordId}`,source.id,JSON.stringify({...record,uploadDossierId:dossierId??null,verifiedInThisLibrary:false}));
   // Canonicalize only this record's former slash/backslash identities in the same commit.
   for(const alias of prefixes)if(alias!==prefix)ctx.db.prepare('DELETE FROM origins WHERE id=?').run(`${alias}:${recordId}`);
   const dossier=owner?getDossier(ctx,owner):saveDossier(ctx,{kind:kind(rawCategory,record.dossierKind),title,aliases:[],dateRange:{start:unknown,end:unknown,ongoing:false},organization:'',role:'',summary:'',skills:[],typedDetails:{},favorite:false},null);
   if(!dossierId){
    for(const alias of prefixes)if(alias!==prefix)ctx.db.prepare('DELETE FROM catalog_topics WHERE catalog_key=? AND topic_key=?').run(alias,topicKey);
    ctx.db.prepare('INSERT INTO catalog_topics VALUES(?,?,?) ON CONFLICT(catalog_key,topic_key) DO UPDATE SET dossier_id=excluded.dossier_id').run(prefix,topicKey,dossier.id);
   }
   ctx.db.prepare('INSERT OR IGNORE INTO dossier_sources VALUES(?,?)').run(dossier.id,source.id);
   return {sourceId:source.id,newSource,changed};
  });}catch(error){if((error as any).code==='AMBIGUOUS_TOPIC'){report.errors.push({record:String(record.id??index),code:'AMBIGUOUS_TOPIC'});continue;}throw error;}
  if(!report.sourceIds.includes(committed.sourceId))report.sourceIds.push(committed.sourceId);
  if(committed.newSource)report.newSources++;if(committed.changed)report.changed++;
  ctx.db.prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data').run('lastImport',JSON.stringify({...report,processed:index+1,total:records.length}));
 }
 report.sourceCount=Number(ctx.db.prepare('SELECT count(*) n FROM sources').get()!.n);report.originCount=Number(ctx.db.prepare('SELECT count(*) n FROM origins').get()!.n);ctx.db.prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data').run('lastImport',JSON.stringify(report));return report;
}
export async function relocateSource(ctx:LibraryContext,id:string,candidate:string){return ctx.writeQueue(async()=>{const s=getSource(ctx,id),path=await safePath(ctx,candidate),check=await hashStable(path);if(check.hash!==s.hash)throw new AppError('HASH_MISMATCH','该文件与原件指纹不一致');const updated={...s,relativePath:relative(ctx.libraryRoot,path).replaceAll('\\','/'),availability:'available' as const};transaction(ctx.db,()=>{updateSource(ctx,updated);ctx.db.prepare('UPDATE source_versions SET relative_path=?,available=1 WHERE source_id=? AND version=?').run(updated.relativePath,id,s.version);});return updated;});}
export async function importFiles(ctx:LibraryContext,inputs:AsyncIterable<IncomingFile>,dossierId?:string){if(dossierId)getDossier(ctx,dossierId);const folder=join(ctx.libraryRoot,'用户补充');await mkdir(folder,{recursive:true});await safePath(ctx,'用户补充');const records:any[]=[];for await(const file of inputs){if(file.name!==basename(file.name)||/[<>:"/\\|?*\x00-\x1f]/.test(file.name)||file.name.length>160)throw new AppError('INVALID_NAME','文件名称无效');const id=randomUUID(),target=join(folder,`${id}-${file.name}`),tmp=target+'.part';let bytes=0;try{await pipeline(Readable.from(file.stream),new Transform({transform(chunk,_encoding,callback){bytes+=chunk.length;callback(bytes>512*1024*1024?new AppError('TOO_LARGE','文件超过 512 MiB'):null,chunk);}}),createWriteStream(tmp,{flags:'wx'}));await rename(tmp,target);records.push({id,archiveRel:relative(ctx.libraryRoot,target),subject:'待整理材料',category:'待整理'});}catch(e){await rm(tmp,{force:true});throw e;}}return ctx.writeQueue(()=>importRecords(ctx,records,'managed-upload',dossierId));}
