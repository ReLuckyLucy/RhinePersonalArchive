import { createHash,randomBytes,randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import type { IncomingMessage,ServerResponse } from 'node:http';
import { AppError } from '../shared/errors.ts';
import { APP_ID,type SessionData } from '../shared/api.ts';
export function sessions(libraryRoot:string){
 const entries=new Map<string,{csrf:string;expires:number}>(),instanceId=randomUUID();
 const root=realpathSync.native(libraryRoot);
 const libraryId=createHash('sha256').update(process.platform==='win32'?root.toLowerCase():root).digest('hex');
 const cookieId=(req:IncomingMessage)=>req.headers.cookie?.match(/(?:^|;\s*)rhine_session=([a-f0-9]{64})(?:;|$)/)?.[1];
 function boundary(req:IncomingMessage){const origin=`http://127.0.0.1:${req.socket.localPort}`;if(req.headers.host!==`127.0.0.1:${req.socket.localPort}`||(req.headers.origin&&req.headers.origin!==origin)||req.headers['sec-fetch-site']==='cross-site')throw new AppError('FOREIGN_REQUEST','仅允许本机页面访问',403);}
 return {instanceId,boundary,create(req:IncomingMessage,res:ServerResponse):SessionData{
  boundary(req);const now=Date.now();
  for(const [key,item]of entries)if(item.expires<=now)entries.delete(key);
  const existingId=cookieId(req),existing=existingId?entries.get(existingId):undefined;
  const id=existing?existingId!:randomBytes(32).toString('hex'),csrf=existing?.csrf??randomBytes(32).toString('hex');
  entries.set(id,{csrf,expires:now+24*3600*1000});
  res.setHeader('Set-Cookie',`rhine_session=${id}; HttpOnly; SameSite=Strict; Path=/`);
  return {csrf,instanceId,libraryId,appId:APP_ID};
 },check(req:IncomingMessage){
  boundary(req);const id=cookieId(req),entry=id?entries.get(id):undefined;
  if(!entry||entry.expires<=Date.now())throw new AppError('SESSION_REQUIRED','请刷新本机页面重新连接',401);
  if(!['GET','HEAD'].includes(req.method??'GET')&&req.headers['x-csrf-token']!==entry.csrf)throw new AppError('CSRF','本机会话验证失败，请刷新',403);
 }};
}
