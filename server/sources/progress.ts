import type {LibraryContext} from '../db/database.ts';
import type {Source} from '../../shared/domain.ts';
import type {ExtractionSnapshot,ExtractionState} from '../../shared/api.ts';
import {getDossier} from '../archive/repository.ts';

export function extractionSnapshot(ctx:LibraryContext,dossierId?:string):ExtractionSnapshot{
 if(dossierId)getDossier(ctx,dossierId);
 const rows=ctx.db.prepare(`WITH latest AS (
  SELECT source_id,version,state,json_extract(data,'$.error') error,
   row_number() OVER(PARTITION BY source_id,version ORDER BY rowid DESC) position FROM jobs
 ) SELECT s.data,j.state,j.error FROM sources s LEFT JOIN latest j
 ON j.source_id=s.id AND j.version=json_extract(s.data,'$.version') AND j.position=1
 WHERE (? IS NULL OR EXISTS(SELECT 1 FROM dossier_sources ds WHERE ds.source_id=s.id AND ds.dossier_id=?))
 ORDER BY s.rowid`).all(dossierId??null,dossierId??null);
 const counts:ExtractionSnapshot['counts']={pending:0,queued:0,running:0,ready:0,failed:0,unsupported:0};
 const materials=rows.map(row=>{
  const source=JSON.parse(row.data as string) as Source;
  const state=(row.state??source.extractionState) as ExtractionState;
  counts[state]++;
  return {id:source.id,name:source.name,version:source.version,state,...(state==='failed'&&row.error?{errorCode:String(row.error)}:{})};
 });
 return {total:materials.length,counts,materials};
}
