import { realpath,stat,open } from 'node:fs/promises';import { resolve,relative,isAbsolute,sep } from 'node:path';import { createHash } from 'node:crypto';import type { LibraryContext } from '../db/database.ts';import { AppError } from '../../shared/errors.ts';
export async function safePath(ctx:LibraryContext,input:string){
 if(typeof input!=='string'||!input||isAbsolute(input)||/[:\x00-\x1f]/.test(input)||input.startsWith('\\'))throw new AppError('UNSAFE_PATH','材料路径无效');
 const segments=input.replaceAll('\\','/').split('/');if(segments.some(s=>s==='..'||/[. ]$/.test(s)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s)||s.toLowerCase()==='.rhine-archive'))throw new AppError('UNSAFE_PATH','材料路径不在可读取范围');
 const path=await realpath(resolve(ctx.libraryRoot,input));const rel=relative(ctx.libraryRoot,path);if(rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel))throw new AppError('UNSAFE_PATH','材料路径不在资料库内');return path;
}
export async function hashStable(path:string,afterRead?:()=>Promise<void>):Promise<{hash:string;bytes:number}>{
 for(let attempt=0;attempt<2;attempt++){const handle=await open(path,'r');try{const before=await handle.stat({bigint:true});if(!before.isFile())throw new AppError('NOT_FILE','不是可读取的文件');const hash=createHash('sha256');for await(const data of handle.createReadStream({autoClose:false}))hash.update(data);await afterRead?.();const after=await stat(path,{bigint:true});if(before.size===after.size&&before.mtimeNs===after.mtimeNs&&before.ctimeNs===after.ctimeNs&&before.ino===after.ino)return {hash:hash.digest('hex'),bytes:Number(after.size)};}finally{await handle.close();}}
 throw new AppError('UNSTABLE_SOURCE','材料正在被修改，请保存文件后重试',409);
}
