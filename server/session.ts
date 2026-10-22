import { randomBytes,randomUUID } from 'node:crypto';
import type { IncomingMessage,ServerResponse } from 'node:http';
import { AppError } from '../shared/errors.ts';
import { APP_ID } from '../shared/api.ts';
export function sessions(){const entries=new Map<string,{csrf:string;expires:number}>();const instanceId=randomUUID();
 function boundary(req:IncomingMessage){const origin=`http://127.0.0.1:${req.socket.localPort}`;if(req.headers.host!==`127.0.0.1:${req.socket.localPort}`||(req.headers.origin&&req.headers.origin!==origin)||req.headers['sec-fetch-site']==='cross-site')throw new AppError('FOREIGN_REQUEST','仅允许本机页面访问',403);}
 return {instanceId,boundary,create(req:IncomingMessage,res:ServerResponse){boundary(req);const id=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');for(const [key,item]of entries)if(item.expires<Date.now())entries.delete(key);entries.set(id,{csrf,expires:Date.now()+24*3600*1000});res.setHeader('Set-Cookie',`rhine_session=${id}; HttpOnly; SameSite=Strict; Path=/`);return {csrf,instanceId,appId:APP_ID};},check(req:IncomingMessage){boundary(req);const id=req.headers.cookie?.match(/(?:^|;\s*)rhine_session=([a-f0-9]{64})(?:;|$)/)?.[1];const s=id?entries.get(id):undefined;if(!s||s.expires<Date.now())throw new AppError('SESSION_REQUIRED','请刷新本机页面重新连接',401);if(!['GET','HEAD'].includes(req.method??'GET')&&req.headers['x-csrf-token']!==s.csrf)throw new AppError('CSRF','本机会话验证失败，请刷新',403);}};
}
