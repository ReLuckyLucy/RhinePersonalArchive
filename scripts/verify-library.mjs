import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openLibrary,closeLibrary} from '../server/db/database.ts';
import {hashStable,safePath} from '../server/sources/paths.ts';
import {importCatalog} from '../server/sources/import.ts';
import {loadConfig} from '../server/config.ts';

export async function fingerprintOriginals(root,folder='') {
 const result=[];
 for(const entry of await readdir(join(root,folder),{withFileTypes:true})) {
  if(entry.name==='.rhine-archive')continue;
  const rel=folder?folder+'/'+entry.name:entry.name;
  if(entry.isDirectory())result.push(...await fingerprintOriginals(root,rel));
  else if(entry.isFile())result.push({path:rel,...await hashStable(await safePath({libraryRoot:root},rel))});
  else throw new Error('Original inventory contains an unsupported link');
 }
 return result.sort((a,b)=>a.path.localeCompare(b.path));
}
export async function verifyLibraryImport({root,manifestPath='资料库清单.json',reportPath}) {
 const before=await fingerprintOriginals(root);
 const manifest=JSON.parse(await readFile(await safePath({libraryRoot:root},manifestPath),'utf8'));
 const records=Array.isArray(manifest)?manifest:manifest.records;
 if(!Array.isArray(records))throw new Error('INVALID_CATALOG');
 const ctx=await openLibrary(root);
 let imported,repeated;
 try {imported=await importCatalog(ctx,manifestPath);repeated=await importCatalog(ctx,manifestPath);}finally{await closeLibrary(ctx);}
 const after=await fingerprintOriginals(root);
 const unchanged=JSON.stringify(before)===JSON.stringify(after);
 const oldHashDifferences=records.filter(record=>record.sha256&&before.find(f=>f.path===record.archiveRel)?.hash!==record.sha256.toLowerCase()).map(record=>record.id);
 const report={at:new Date().toISOString(),originalFileCount:before.length,originalBytes:before.reduce((n,f)=>n+f.bytes,0),records:records.length,imported,repeated,oldHashDifferences,unchanged,before,after};
 if(reportPath){await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,JSON.stringify(report,null,2));}
 if(!unchanged)throw new Error('ORIGINAL_FINGERPRINT_CHANGED');
 if(imported.errors.length||imported.missing||repeated.newSources||repeated.changed)throw new Error('IMPORT_RECONCILIATION_FAILED');
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const config=await loadConfig();const report=await verifyLibraryImport({root:config.libraryRoot,reportPath:resolve('verification/private/import-report.json')});console.log(JSON.stringify({records:report.records,sources:report.imported.sourceCount,origins:report.imported.originCount,originals:report.originalFileCount,unchanged:report.unchanged,oldHashDifferences:report.oldHashDifferences.length}));}
