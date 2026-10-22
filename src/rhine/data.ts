import type {Dossier} from '../../shared/domain.ts';
export let records:Dossier[]=[];
export let archiveColumns:string[]=[];
const order=['education','work','project','award','research','volunteer','portfolio','reference'];
let columns:number[][]=[];
export function setDossiers(input:Dossier[]){
  records=[...input];
  archiveColumns=order.filter(kind=>records.some(d=>d.kind===kind));
  columns=archiveColumns.map(kind=>records.flatMap((d,index)=>d.kind===kind?[index]:[]));
}
export function columnFiles(lane:number){return columns[lane]??[];}
export function fileLocation(index:number){
  const record=records[index];
  if(!record)throw new Error('Unknown dossier index');
  const lane=archiveColumns.indexOf(record.kind);
  return {lane,row:12+columns[lane].indexOf(index),slot:index};
}
export function fileAtSlot(slot:number){return slot;}
// Rebase only at a shared repeat boundary, so unequal columns retain identity.
export function rowPeriod(){
  const gcd=(a:number,b:number):number=>b?gcd(b,a%b):a;
  let period=1;
  for(const col of columns){period=period/gcd(period,col.length)*col.length;if(period>2048)return Infinity;}
  return period;
}
