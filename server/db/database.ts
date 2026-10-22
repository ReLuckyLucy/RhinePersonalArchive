import { DatabaseSync } from 'node:sqlite';
import { mkdir,realpath } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { migrate } from './migrations.ts';
import { writeQueue } from './transaction.ts';
export type LibraryContext={db:DatabaseSync;libraryRoot:string;runtimeRoot:string;exportRoot:string;writeQueue:ReturnType<typeof writeQueue>};
export async function openLibrary(root:string):Promise<LibraryContext>{
 await mkdir(root,{recursive:true});const libraryRoot=await realpath(resolve(root));const runtimeRoot=join(libraryRoot,'.rhine-archive');const exportRoot=join(runtimeRoot,'exports');
 await mkdir(exportRoot,{recursive:true});const db=new DatabaseSync(join(runtimeRoot,'library.sqlite'));
 try{db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');await migrate(db,runtimeRoot);return {db,libraryRoot,runtimeRoot,exportRoot,writeQueue:writeQueue()};}catch(error){db.close();throw error;}
}
export async function closeLibrary(ctx:LibraryContext){await ctx.writeQueue(async()=>{});ctx.db.close();}
