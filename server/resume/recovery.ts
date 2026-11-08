import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {LibraryContext} from '../db/database.ts';
import {transaction} from '../db/transaction.ts';
import {AppError} from '../../shared/errors.ts';
import {resumeRecoveryInput,type ResumeRecovery,type ResumeRecoverySummary} from '../../shared/resume-recovery.ts';

const revision=z.number().int().positive();
export function getResumeRecovery(ctx:LibraryContext,id:string):ResumeRecovery{
 const row=ctx.db.prepare('SELECT id,revision,data,updated_at FROM resume_recoveries WHERE id=?').get(z.uuid().parse(id));
 if(!row)throw new AppError('NOT_FOUND','未找到简历恢复记录',404);
 return{id:String(row.id),revision:Number(row.revision),snapshot:JSON.parse(String(row.data)),updatedAt:String(row.updated_at)};
}
export function listResumeRecoveries(ctx:LibraryContext):ResumeRecoverySummary[]{
 return ctx.db.prepare('SELECT id,revision,data,updated_at FROM resume_recoveries ORDER BY updated_at DESC,id').all().map(row=>{
  const snapshot=JSON.parse(String(row.data));return{id:String(row.id),revision:Number(row.revision),draftId:snapshot.draft.id,roleTitle:snapshot.draft.roleTitle,selectedCount:snapshot.draft.sections.reduce((count:number,section:{factIds:string[]})=>count+section.factIds.length,0),updatedAt:String(row.updated_at)};
 });
}
export function saveResumeRecovery(ctx:LibraryContext,input:unknown,expectedRevision:unknown,id?:string):ResumeRecovery{
 const snapshot=resumeRecoveryInput.parse(input);if(Buffer.byteLength(JSON.stringify(snapshot))>1024*1024)throw new AppError('TOO_LARGE','简历恢复内容过大',413);
 return transaction(ctx.db,()=>{
  const updatedAt=new Date().toISOString();
  if(id){z.uuid().parse(id);const expected=revision.parse(expectedRevision);const result=ctx.db.prepare('UPDATE resume_recoveries SET revision=revision+1,data=?,updated_at=? WHERE id=? AND revision=?').run(JSON.stringify(snapshot),updatedAt,id,expected);if(!result.changes)throw new AppError('CONFLICT','此恢复记录已被其他页面修改，请保留当前输入并重新打开简历工作台',409);}
  else{if(expectedRevision!==null)throw new AppError('VALIDATION','新恢复记录不应携带版本');id=randomUUID();ctx.db.prepare('INSERT INTO resume_recoveries(id,revision,data,updated_at) VALUES(?,1,?,?)').run(id,JSON.stringify(snapshot),updatedAt);}
  return getResumeRecovery(ctx,id);
 });
}
export function discardResumeRecovery(ctx:LibraryContext,id:string,expectedRevision:unknown){
 z.uuid().parse(id);const expected=revision.parse(expectedRevision);
 const result=ctx.db.prepare('DELETE FROM resume_recoveries WHERE id=? AND revision=?').run(id,expected);
 if(!result.changes)throw new AppError('CONFLICT','恢复记录已更新，未删除其他页面的编辑',409);
}
