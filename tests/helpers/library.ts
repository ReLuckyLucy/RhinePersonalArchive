import type { TestContext } from 'node:test';
import { mkdir,mkdtemp,rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLibrary,closeLibrary } from '../../server/db/database.ts';
export async function createTestLibrary(t:TestContext){const parent=resolve('runtime/tests');await mkdir(parent,{recursive:true});const root=await mkdtemp(parent+'/library-');const ctx=await openLibrary(root);t.after(async()=>{await closeLibrary(ctx);if(!root.startsWith(parent))throw new Error('Unsafe cleanup');await rm(root,{recursive:true,force:true});});return ctx;}
