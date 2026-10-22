import type { DatabaseSync } from 'node:sqlite';
let savepointSequence=0;
export function transaction<T>(db:DatabaseSync,work:()=>T):T {
 const savepoint=db.isTransaction?`rhine_${++savepointSequence}`:undefined;
 db.exec(savepoint?`SAVEPOINT ${savepoint}`:'BEGIN IMMEDIATE');
 try{const result=work();db.exec(savepoint?`RELEASE SAVEPOINT ${savepoint}`:'COMMIT');return result;}
 catch(error){if(db.isTransaction){if(savepoint){db.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);db.exec(`RELEASE SAVEPOINT ${savepoint}`);}else db.exec('ROLLBACK');}throw error;}
}
export function writeQueue(){let tail=Promise.resolve();return <T>(work:()=>Promise<T>):Promise<T>=>{const next=tail.then(work);tail=next.then(()=>{},()=>{});return next;};}
