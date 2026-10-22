import { randomUUID } from 'node:crypto';
import type { LibraryContext } from '../db/database.ts';
import type { Dossier,DossierFilter,Profile } from '../../shared/domain.ts';
import { dossierInput,profileInput,revisionSchema } from '../../shared/schemas.ts';
import { AppError } from '../../shared/errors.ts';
import { transaction } from '../db/transaction.ts';
export function saveDossier(ctx:LibraryContext,input:unknown,expectedRevision:number|null):Dossier{
 const data=dossierInput.parse(input);revisionSchema.parse(expectedRevision);
 return transaction(ctx.db,()=>{const row=data.id?ctx.db.prepare('SELECT data FROM dossiers WHERE id=?').get(data.id):undefined;const old=row?JSON.parse(row.data as string) as Dossier:undefined;
 if((old?.revision??null)!==expectedRevision||(data.id&&!old))throw new AppError('CONFLICT','档案已更新，请刷新后重试',409);
 const item:Dossier={...data,id:old?.id??randomUUID(),revision:(old?.revision??0)+1,archivedAt:old?.archivedAt??new Date().toISOString()};
 ctx.db.prepare('INSERT INTO dossiers VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,data=excluded.data').run(item.id,item.revision,JSON.stringify(item));return item;});
}
export function listDossiers(ctx:LibraryContext,filter:DossierFilter):Dossier[]{return ctx.db.prepare('SELECT data FROM dossiers').all().map(r=>JSON.parse(r.data as string) as Dossier).filter(d=>(filter.status==='archived'?!!ctx.db.prepare('SELECT 1 FROM settings WHERE key=?').get('archived-dossier:'+d.id):!ctx.db.prepare('SELECT 1 FROM settings WHERE key=?').get('archived-dossier:'+d.id))&&(!filter.kind||filter.kind==='all'||d.kind===filter.kind)&&(!filter.favorite||d.favorite)).sort((a,b)=>filter.sort==='date'?(b.dateRange.start.value??'').localeCompare(a.dateRange.start.value??''):(b.visitedAt??b.archivedAt).localeCompare(a.visitedAt??a.archivedAt));}
export function getDossier(ctx:LibraryContext,id:string):Dossier{const row=ctx.db.prepare('SELECT data FROM dossiers WHERE id=?').get(id);if(!row)throw new AppError('NOT_FOUND','没有找到档案',404);return JSON.parse(row.data as string);}
export function visitDossier(ctx:LibraryContext,id:string){const d=getDossier(ctx,id);ctx.db.prepare('UPDATE dossiers SET data=? WHERE id=?').run(JSON.stringify({...d,visitedAt:new Date().toISOString()}),id);}
export function readProfile(ctx:LibraryContext):Profile {const row=ctx.db.prepare("SELECT data FROM profile WHERE id='main'").get();return row?JSON.parse(row.data as string):{id:'main',name:'',email:'',phone:'',location:'',headline:'',revision:0};}
export function saveProfile(ctx:LibraryContext,input:unknown,expectedRevision:number|null):Profile{const data=profileInput.parse(input);revisionSchema.parse(expectedRevision);return transaction(ctx.db,()=>{const old=readProfile(ctx);if((old.revision||null)!==expectedRevision)throw new AppError('CONFLICT','个人信息已更新，请刷新',409);const item:Profile={...data,id:'main',revision:old.revision+1};ctx.db.prepare('INSERT INTO profile VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,data=excluded.data').run('main',item.revision,JSON.stringify(item));return item;});}
