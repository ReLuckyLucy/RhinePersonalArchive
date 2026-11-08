import {z} from 'zod';
import {resumeDraftInput} from './schemas.ts';

// Recovery accepts incomplete editing strings; formal profile saving still validates email.
const editingString=z.string().max(500);
export const resumeRecoveryInput=z.object({
 draft:resumeDraftInput,
 baseRevision:z.number().int().positive().nullable(),
 profileRevision:z.number().int().nonnegative(),
 profileEdits:z.object({name:editingString,email:editingString,phone:editingString,location:editingString,headline:editingString}).strict()
}).strict().refine(value=>!!value.draft.id===!!value.baseRevision,{message:'恢复记录的草稿与基础版本不匹配'});
export type ResumeRecoveryInput=z.infer<typeof resumeRecoveryInput>;
export type ResumeRecoveryRef={id:string;revision:number};
export type ResumeRecovery=ResumeRecoveryRef&{snapshot:ResumeRecoveryInput;updatedAt:string};
export type ResumeRecoverySummary=ResumeRecoveryRef&{draftId?:string;roleTitle:string;selectedCount:number;updatedAt:string};
