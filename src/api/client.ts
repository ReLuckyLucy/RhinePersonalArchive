import {APP_ID,type SessionData} from '../../shared/api.ts';
import type {Result} from '../../shared/domain';

let current:SessionData|undefined,pending:Promise<SessionData>|undefined;
let libraryId:string|undefined,libraryChanged:Error|undefined;

function checkLibrary(){if(libraryChanged)throw libraryChanged;}

function waitForSession(connection:Promise<SessionData>,signal?:AbortSignal):Promise<SessionData>{
 if(!signal)return connection;
 signal.throwIfAborted();
 return new Promise((resolve,reject)=>{
  const abort=()=>reject(signal.reason);
  signal.addEventListener('abort',abort,{once:true});
  connection.then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});
 });
}

async function session(signal?:AbortSignal):Promise<SessionData>{
 signal?.throwIfAborted();checkLibrary();
 if(current)return current;
 pending??=fetch('/api/session',{credentials:'same-origin'}).then(async response=>{
  const result:Result<SessionData>=await response.json();
  if(!result.ok)throw new Error(result.error?.message??'连接失败');
  if(!response.ok)throw new Error('连接失败');
  const data=result.data;
  if(!data||data.appId!==APP_ID||typeof data.csrf!=='string'||!data.csrf||typeof data.instanceId!=='string'||!data.instanceId||typeof data.libraryId!=='string'||!data.libraryId)throw new Error('本机会话连接信息无效，请刷新页面');
  if(libraryId!==undefined&&data.libraryId!==libraryId){
   libraryChanged=new Error('资料库已切换，请刷新页面后再操作');throw libraryChanged;
  }
  libraryId=data.libraryId;current=data;return data;
 }).finally(()=>{pending=undefined;});
 return waitForSession(pending,signal);
}

async function request<T>(url:string,init:RequestInit,signal?:AbortSignal):Promise<T>{
 let authorization=await session(signal);
 for(let attempt=0;attempt<2;attempt++){
  signal?.throwIfAborted();checkLibrary();
  const headers=new Headers(init.headers);
  if(init.method==='POST')headers.set('X-CSRF-Token',authorization.csrf);
  const response=await fetch(url,{...init,headers,credentials:'same-origin',signal});
  const result:Result<T>=await response.json();
  signal?.throwIfAborted();checkLibrary();
  if(!result.ok){
   const rejected=(response.status===401&&result.error.code==='SESSION_REQUIRED')||(response.status===403&&result.error.code==='CSRF');
   if(attempt===0&&rejected){
    // A response from an old request must not invalidate a completed renewal.
    if(current===authorization)current=undefined;
    authorization=await session(signal);continue;
   }
   throw new Error(result.error.message);
  }
  if(!response.ok)throw new Error('连接失败');
  return result.data;
 }
 throw new Error('连接失败');
}

export async function uploadFile(file:File,dossierId?:string,signal?:AbortSignal){
 return request<any>('/api/sources/upload'+(dossierId?'?dossierId='+encodeURIComponent(dossierId):''),{
  method:'POST',headers:{'X-File-Name':encodeURIComponent(file.name)},body:file,
 },signal);
}

export async function api<T>(path:string,body?:unknown,signal?:AbortSignal):Promise<T>{
 return request<T>('/api/'+path,{
  method:body===undefined?'GET':'POST',
  headers:body===undefined?{}:{'Content-Type':'application/json'},
  body:body===undefined?undefined:JSON.stringify(body),
 },signal);
}
