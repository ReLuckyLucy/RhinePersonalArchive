import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setDossiers, records, archiveColumns, columnFiles, fileLocation, fileAtSlot, rowPeriod} from '../../src/rhine/data.ts';
import {fileAtCell, selectionCell} from '../../src/rhine/archive-loop.ts';
import type {Dossier} from '../../shared/domain.ts';
const item=(id:string,kind:Dossier['kind'])=>({id,kind,title:id} as Dossier);
test('real dossiers map to unequal nonempty columns, stable identities and long rows',()=>{
  const input=[item('work','work'),...Array.from({length:45},(_,i)=>item('project-'+i,'project')),item('education','education'),item('reference','reference')];
  setDossiers(input);
  assert.deepEqual(archiveColumns,['education','work','project','reference']);
  assert.equal(records.length,input.length);
  for(let index=0;index<records.length;index++){
    const p=fileLocation(index);
    assert.equal(fileAtSlot(p.slot),index);
    assert.equal(fileAtCell(p),index);
    assert.equal(fileAtCell({lane:p.lane+archiveColumns.length*9,row:p.row+columnFiles(p.lane).length*11}),index);
    assert.equal(fileAtCell({lane:p.lane-archiveColumns.length*9,row:p.row-columnFiles(p.lane).length*11}),index);
  }
  const last=records.findIndex(d=>d.id==='project-44'),first=records.findIndex(d=>d.id==='project-0');
  const end=fileLocation(last),next=selectionCell(first,end,{axis:'row',direction:1});
  assert.equal(next.row,end.row+1);assert.equal(fileAtCell(next),first);
  assert.equal(rowPeriod(),45);
  setDossiers([]);assert.equal(archiveColumns.length,0);assert.equal(records.length,0);
});
