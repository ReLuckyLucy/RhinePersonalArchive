import { openLibrary,closeLibrary } from './db/database.ts';
import { loadConfig,getConfigPath,getBindHost } from './config.ts';
import { createLocalApp } from './app.ts';
import{mkdir,writeFile,rm,readFile}from'node:fs/promises';import{dirname,join}from'node:path';import{APP_ID}from'../shared/api.ts';
let app:Awaited<ReturnType<typeof createLocalApp>>|undefined,ctx:Awaited<ReturnType<typeof openLibrary>>|undefined,stopping=false;
const recordPath=join(dirname(getConfigPath()),'instance.json');
async function start(){const config=await loadConfig();const host=getBindHost();process.env.PLAYWRIGHT_BROWSERS_PATH=config.browserDirectory;ctx=await openLibrary(config.libraryRoot);app=await createLocalApp(ctx,{dev:process.argv.includes('--dev'),onShutdown:()=>void stop(false),onRestart:()=>void stop(true)});try{await new Promise<void>((done,reject)=>{app!.server.once('error',reject);app!.server.listen(config.port,host,done);});await mkdir(dirname(recordPath),{recursive:true});await writeFile(recordPath,JSON.stringify({appId:APP_ID,instanceId:app.instanceId,pid:process.pid,port:config.port}));console.log(`Rhine 个人档案：http://127.0.0.1:${config.port}`);}catch(error){await app.close();await closeLibrary(ctx);app=undefined;ctx=undefined;throw error;}}
async function stop(restart:boolean){if(stopping)return;stopping=true;await app?.close();if(ctx)await closeLibrary(ctx);try{const record=JSON.parse(await readFile(recordPath,'utf8'));if(record.instanceId===app?.instanceId)await rm(recordPath,{force:true});}catch{}app=undefined;ctx=undefined;stopping=false;if(restart)await start().catch(fail);}
function fail(error:unknown){console.error((error as NodeJS.ErrnoException).code==='EADDRINUSE'?'PORT_IN_USE：端口已被占用':'启动失败：'+(error as Error).message);process.exitCode=1;}
process.on('SIGINT',()=>void stop(false));process.on('SIGTERM',()=>void stop(false));await start().catch(fail);
