import {parentPort,workerData} from 'node:worker_threads';import {extractFile} from './extract.ts';
try{parentPort!.postMessage({ok:true,data:await extractFile(workerData.path,workerData.kind,workerData.assetDirectory)});}catch(e){parentPort!.postMessage({ok:false,code:(e as any).code??'EXTRACT_FAILED'});}
