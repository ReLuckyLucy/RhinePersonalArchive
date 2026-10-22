import { createServer,type IncomingMessage,type ServerResponse } from 'node:http';
import { readFile,readdir,realpath } from 'node:fs/promises';
import { resolve,extname,sep,basename } from 'node:path';
import { ZodError } from 'zod';
import type { LibraryContext } from './db/database.ts';
import { sessions } from './session.ts';
import { listDossiers,saveDossier,readProfile,saveProfile,getDossier } from './archive/repository.ts';
import { listFacts,saveFact,confirmFact,withdrawFact,getFactHistory,listReviewItems } from './archive/facts.ts';
import { mergeDossiers,archiveDossier,restoreDossier } from './archive/organize.ts';
import { visitDossier } from './archive/repository.ts';
import { AppError } from '../shared/errors.ts';
import { APP_ID,type LibraryInfo } from '../shared/api.ts';
import { importCatalog,importFiles,relocateSource } from './sources/import.ts';
import { listSources } from './sources/repository.ts';
import { sendSource,openSource } from './sources/http.ts';
import { enqueueExtraction,runPendingJobs,recoverJobs } from './sources/jobs.ts';
import {extractionSnapshot} from './sources/progress.ts';
import { readExtractedText,reviseExtractedText } from './sources/extract.ts';
import { searchArchive } from './search/service.ts';
import {saveResumeDraft,getResumeDraft,listResumeDrafts,buildResumeDocument,freezeResumeVersion,getResumeVersion,listResumeVersions} from './resume/service.ts';
import {matchRole} from './resume/match.ts';
import {exportResume} from './resume/export.ts';
import {createBackup,verifyBackup,activateRestoredLibrary} from './backup/service.ts';
import {loadConfig,saveConfig} from './config.ts';
export async function readJson(req:IncomingMessage){let size=0;const chunks:Buffer[]=[];for await(const chunk of req){size+=chunk.length;if(size>2*1024*1024)throw new AppError('TOO_LARGE','请求内容过大',413);chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AppError('BAD_JSON','请求内容不是有效 JSON');}}
export function json(res:ServerResponse,data:unknown,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({ok:true,data}));}
export async function createLocalApp(ctx:LibraryContext,options:{dev?:boolean;onRestart?:()=>void;onShutdown?:()=>void}={}){
 const auth=sessions();const jobsAbort=new AbortController();recoverJobs(ctx);let processing=Promise.resolve();const processJobs=()=>{processing=processing.then(()=>runPendingJobs(ctx,jobsAbort.signal)).catch(()=>{ /* Jobs stay queued for the next startup if configuration is unavailable. */ });};processJobs();const vite=options.dev?await(await import('vite')).createServer({server:{middlewareMode:true,host:'127.0.0.1'},appType:'spa'}):undefined;
 const server=createServer(async(req,res)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
 try{auth.boundary(req);const url=new URL(req.url??'/',`http://${req.headers.host}`);const route=url.pathname;const method=req.method??'GET';
 if(route==='/api/health'&&method==='GET'){json(res,{appId:APP_ID,instanceId:auth.instanceId,pid:process.pid});return;}
 if(route==='/api/session'&&method==='GET'){json(res,auth.create(req,res));return;}
 if(route.startsWith('/api/')){auth.check(req);
 if(route==='/api/library'&&method==='GET'){
  const counts=ctx.db.prepare(`SELECT
   (SELECT count(*) FROM dossiers) dossierCount,
   (SELECT count(*) FROM dossiers d JOIN settings s ON s.key='archived-dossier:'||d.id) archivedDossierCount,
   (SELECT count(*) FROM sources) sourceCount`).get()!;
  const info:LibraryInfo={name:basename(ctx.libraryRoot)||ctx.libraryRoot,directory:ctx.libraryRoot,dossierCount:Number(counts.dossierCount),archivedDossierCount:Number(counts.archivedDossierCount),sourceCount:Number(counts.sourceCount)};
  json(res,info);return;
 }
 if(route==='/api/shutdown'&&method==='POST'){const b=await readJson(req);if(!options.onShutdown||b.instanceId!==auth.instanceId)throw new AppError('INSTANCE','实例不匹配');json(res,{});setTimeout(options.onShutdown,100);return;}
 if(route==='/api/settings'&&method==='GET'){json(res,{...(await loadConfig()),libraryRoot:ctx.libraryRoot});return;}
 if(route==='/api/settings'&&method==='POST'){const b=await readJson(req),old=await loadConfig();await saveConfig({...old,libraryRoot:b.libraryRoot,backupDirectory:b.backupDirectory});const restart=resolve(b.libraryRoot)!==resolve(ctx.libraryRoot);json(res,{restart});if(restart&&options.onRestart)setTimeout(options.onRestart,100);return;}
 if(route==='/api/backups'&&method==='GET'){const config=await loadConfig();let names:string[]=[];try{names=await readdir(config.backupDirectory);}catch(e){if((e as any).code!=='ENOENT')throw e;}json(res,names.filter(n=>n.endsWith('.growth')).map(fileName=>({fileName})));return;}
 if(route==='/api/backups'&&method==='POST'){const b=await readJson(req),config=await loadConfig();const report=await createBackup(ctx,b.password,config.backupDirectory);json(res,{...report,path:undefined,fileName:report.path?basename(report.path):undefined});return;}
 if(route==='/api/restore'&&method==='POST'){const b=await readJson(req),config=await loadConfig();if(typeof b.fileName!=='string'||basename(b.fileName)!==b.fileName||!b.fileName.endsWith('.growth')||typeof b.restoreDirectory!=='string')throw new AppError('VALIDATION','备份或恢复目录无效');const root=await realpath(config.backupDirectory),file=await realpath(resolve(root,b.fileName));if(!file.startsWith(root+sep))throw new AppError('VALIDATION','备份不在指定目录内');json(res,await verifyBackup(file,b.password,b.restoreDirectory));return;}
 if(route==='/api/restore/activate'&&method==='POST'){if(!options.onRestart)throw new AppError('RESTART_REQUIRED','请通过正式启动入口切换资料库');const b=await readJson(req);await activateRestoredLibrary(b.newRoot);json(res,{});setTimeout(options.onRestart,100);return;}
 if(route==='/api/exports'&&method==='POST'){const b=await readJson(req);json(res,await exportResume(ctx,b.versionId,b.format));return;}
 const exportRoute=/^\/api\/exports\/([a-f0-9-]{36})\/file$/.exec(route);if(exportRoute&&method==='GET'){const row=ctx.db.prepare('SELECT data FROM exports WHERE id=?').get(exportRoute[1]);if(!row)throw new AppError('NOT_FOUND','未找到导出文件',404);const record=JSON.parse(row.data as string);if(record.status!=='success'||!/^resume-[a-f0-9-]{36}\.(pdf|docx)$/.test(record.fileName))throw new AppError('NOT_FOUND','导出未成功',404);const bytes=await readFile(resolve(ctx.exportRoot,record.fileName));res.writeHead(200,{'Content-Type':record.format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':`attachment; filename="${record.fileName}"`,'Cache-Control':'no-store'});res.end(bytes);return;}
 if(route==='/api/resume-drafts'&&method==='GET'){json(res,listResumeDrafts(ctx));return;}
 if(route==='/api/resume-drafts'&&method==='POST'){const b=await readJson(req);json(res,saveResumeDraft(ctx,b.input,b.expectedRevision));return;}
 if(route==='/api/resume-match'&&method==='POST'){const b=await readJson(req);if(typeof b.jobDescription!=='string'||b.jobDescription.length>20000)throw new AppError('VALIDATION','岗位描述无效');json(res,matchRole(ctx,b.jobDescription));return;}
 const draftRoute=/^\/api\/resume-drafts\/([a-f0-9-]{36})\/(build|freeze)$/.exec(route);if(draftRoute){if(method==='GET'&&draftRoute[2]==='build'){json(res,buildResumeDocument(ctx,draftRoute[1]));return;}if(method==='POST'&&draftRoute[2]==='freeze'){const b=await readJson(req);json(res,await freezeResumeVersion(ctx,draftRoute[1],b.expectedRevision));return;}}
 if(route==='/api/resume-versions'&&method==='GET'){json(res,listResumeVersions(ctx));return;}
 const versionRoute=/^\/api\/resume-versions\/([a-f0-9-]{36})$/.exec(route);if(versionRoute&&method==='GET'){json(res,getResumeVersion(ctx,versionRoute[1]));return;}
 if(route==='/api/facts-usage'&&method==='GET'){const id=url.searchParams.get('dossierId');json(res,listResumeVersions(ctx).filter(v=>getResumeVersion(ctx,v.id).facts.some(f=>f.dossierId===id)));return;}
 if(route==='/api/dossiers/merge'&&method==='POST'){const b=await readJson(req);json(res,mergeDossiers(ctx,b.fromId,b.toId,b.fromRevision,b.toRevision));return;}
 const organizeRoute=/^\/api\/dossiers\/([a-f0-9-]{36})\/(archive|restore|visit)$/.exec(route);if(organizeRoute&&method==='POST'){const b=await readJson(req);const [,id,action]=organizeRoute;if(action==='archive')archiveDossier(ctx,id,b.expectedRevision);else if(action==='restore')restoreDossier(ctx,id);else visitDossier(ctx,id);json(res,{});return;}
 if(route==='/api/review'&&method==='GET'){json(res,listReviewItems(ctx));return;}
 if(route==='/api/facts'&&method==='GET'){json(res,listFacts(ctx,url.searchParams.get('dossierId')??undefined));return;}
 if(route==='/api/facts'&&method==='POST'){const b=await readJson(req);json(res,saveFact(ctx,b.input.dossierId,b.input,b.expectedRevision));return;}
 const factRoute=/^\/api\/facts\/([a-f0-9-]{36})\/(confirm|withdraw|history)$/.exec(route);if(factRoute){const [,id,action]=factRoute;if(action==='history'&&method==='GET'){json(res,getFactHistory(ctx,id));return;}if(method==='POST'){const b=await readJson(req);json(res,action==='confirm'?await confirmFact(ctx,id,b.expectedRevision):withdrawFact(ctx,id,b.expectedRevision));return;}}
 const dossierRoute=/^\/api\/dossiers\/([a-f0-9-]{36})$/.exec(route);if(dossierRoute&&method==='GET'){const d=getDossier(ctx,dossierRoute[1]);json(res,{dossier:d,sources:listSources(ctx,d.id),facts:listFacts(ctx,d.id)});return;}
 if(route==='/api/search'&&method==='GET'){json(res,searchArchive(ctx,{text:url.searchParams.get('text')??'',kinds:url.searchParams.has('kind')?[url.searchParams.get('kind')!]:undefined,favorite:url.searchParams.get('favorite')==='true',status:url.searchParams.get('status')||undefined,fileTypes:url.searchParams.has('fileType')?[url.searchParams.get('fileType')!]:undefined,dateRange:{start:url.searchParams.get('from')||undefined,end:url.searchParams.get('to')||undefined},cursor:url.searchParams.get('cursor')??undefined}));return;}
 if(route==='/api/jobs'&&method==='GET'){json(res,ctx.db.prepare('SELECT data FROM jobs ORDER BY rowid DESC').all().map(r=>JSON.parse(r.data as string)));return;}
 if(route==='/api/extraction-status'&&method==='GET'){json(res,extractionSnapshot(ctx,url.searchParams.get('dossierId')??undefined));return;}
 if(route==='/api/jobs'&&method==='POST'){
  const b=await readJson(req),states=b.onlyStates;
  if(states!==undefined&&(!Array.isArray(states)||!states.length||states.some(s=>s!=='pending'&&s!=='failed')))throw new AppError('VALIDATION','提取状态筛选无效');
  const snapshot=extractionSnapshot(ctx),ids=b.sourceIds??snapshot.materials.filter(s=>s.state==='pending'||s.state==='failed').map(s=>s.id);
  if(!Array.isArray(ids)||ids.length>1000||ids.some(id=>typeof id!=='string'||!snapshot.materials.some(s=>s.id===id)))throw new AppError('VALIDATION','材料列表无效');
  const selected=[...new Set<string>(ids)].filter(id=>!states||states.includes(snapshot.materials.find(s=>s.id===id)!.state));
  const jobs=selected.map(id=>enqueueExtraction(ctx,id));processJobs();json(res,jobs);return;
 }
 const textRoute=/^\/api\/sources\/([a-f0-9-]{36})\/text$/.exec(route);if(textRoute){const version=Number(url.searchParams.get('version'));if(method==='GET'){json(res,readExtractedText(ctx,textRoute[1],version));return;}if(method==='POST'){const b=await readJson(req);json(res,reviseExtractedText(ctx,textRoute[1],version,b.text,b.expectedRevision));return;}}
 if(route==='/api/sources'&&method==='GET'){json(res,listSources(ctx,url.searchParams.get('dossierId')??undefined));return;}
 if(route==='/api/sources/import'&&method==='POST'){const b=await readJson(req);const manifestPath=b.manifestPath??'00_总览与索引/资料库清单.json';if(typeof manifestPath!=='string'||!manifestPath.trim()||manifestPath.length>1000)throw new AppError('VALIDATION','请填写资料库内的清单相对路径');json(res,await importCatalog(ctx,manifestPath));return;}
 if(route==='/api/sources/upload'&&method==='POST'){const name=decodeURIComponent(String(req.headers['x-file-name']??''));async function* incoming(){yield{name,stream:req};}const dossierId=url.searchParams.get('dossierId');if(dossierId)getDossier(ctx,dossierId);const report=await importFiles(ctx,incoming(),dossierId??undefined);json(res,report);return;}
 const sourceRoute=/^\/api\/sources\/([a-f0-9-]{36})\/(file|open|relocate)$/.exec(route);
 if(sourceRoute){const [,id,action]=sourceRoute;if(action==='file'&&['GET','HEAD'].includes(method)){await sendSource(ctx,id,req,res,url.searchParams.has('version')?Number(url.searchParams.get('version')):undefined,url.searchParams.get('download')==='1');return;}if(action==='open'&&method==='POST'){await openSource(ctx,id);json(res,{});return;}if(action==='relocate'&&method==='POST'){const b=await readJson(req);json(res,await relocateSource(ctx,id,b.relativePath));return;}}
 if(route==='/api/profile'&&method==='GET'){json(res,readProfile(ctx));return;}
 if(route==='/api/profile'&&method==='POST'){const b=await readJson(req);json(res,saveProfile(ctx,b.input,b.expectedRevision));return;}
 if(route==='/api/dossiers'&&method==='GET'){json(res,listDossiers(ctx,{kind:url.searchParams.get('kind')??undefined,status:url.searchParams.get('status')??undefined,favorite:url.searchParams.get('favorite')==='true'}));return;}
 if(route==='/api/dossiers'&&method==='POST'){const b=await readJson(req);json(res,saveDossier(ctx,b.input,b.expectedRevision));return;}
 throw new AppError('NOT_FOUND','接口不存在',404);
 }
 if(route==='/resume-fonts.css'){res.writeHead(200,{'Content-Type':'text/css'});res.end(await readFile('src/fonts.css'));return;}
 if(vite){vite.middlewares(req,res,()=>{res.writeHead(404);res.end();});return;}
 const root=resolve('dist');const file=resolve(root,'.'+decodeURIComponent(route==='/'?'/index.html':route));if(!file.startsWith(root+sep))throw new AppError('NOT_FOUND','页面不存在',404);
 const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.pdf':'application/pdf'};const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Cache-Control':'no-cache'});res.end(data);
 }catch(error){const e=error as any;const status=e instanceof ZodError?400:e instanceof AppError?e.status:e.code==='ENOENT'?404:500;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({ok:false,error:{code:e instanceof ZodError?'VALIDATION':e instanceof AppError?e.code:'INTERNAL',message:e instanceof ZodError?'填写的信息有误，请检查日期与字段':e instanceof AppError?e.message:'操作失败，请重试并检查本机文件权限'}}));}});
 return {server,instanceId:auth.instanceId,close:async()=>{jobsAbort.abort();await processing;await vite?.close();await new Promise<void>((resolve,reject)=>{if(!server.listening)return resolve();server.close(e=>e?reject(e):resolve());server.closeIdleConnections();});}};
}
